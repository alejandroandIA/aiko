// Aiko - Conversational AI with Voice using OpenAI Realtime API
console.log("Aiko: Script inizializzato");

// Aspetta che il DOM sia caricato
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aiko: DOM caricato");
    
    // Elementi DOM
    const talkButton = document.getElementById('talkButton');
    const endButton = document.getElementById('endButton');
    const statusDiv = document.getElementById('status');
    const aiAudioPlayer = document.getElementById('aiAudioPlayer');
    const voiceIndicator = document.getElementById('voiceIndicator');
    const aikoFaceElement = document.getElementById('aikoFace');
    const faceCanvas = document.getElementById('faceCanvas');
    const matrixCanvasElement = document.getElementById('matrixCanvas');

    // API Configuration
    const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17";
    const REALTIME_API_URL = "https://api.openai.com/v1/realtime";
    
    // Get API key from localStorage or prompt
    let API_KEY = localStorage.getItem('openai_api_key');
    if (!API_KEY) {
        API_KEY = prompt('Inserisci la tua chiave API OpenAI:');
        if (API_KEY) {
            localStorage.setItem('openai_api_key', API_KEY);
        } else {
            alert('Chiave API necessaria per funzionare!');
            return;
        }
    }

    // WebRTC variables
    let pc = null;
    let dc = null;
    let localStream = null;
    let isActive = false;

    // Matrix Animation Setup
    function initMatrixAnimation() {
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        matrixCanvasElement.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        const columns = Math.floor(canvas.width / 20);
        const drops = Array(columns).fill(0);
        
        const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+{}[]|;:,.<>?アイコウエオカキクケコサシスセソタチツテト";
        
        function drawMatrix() {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#00ff41';
            ctx.font = '16px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const text = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                ctx.fillText(text, i * 20, drops[i] * 20);
                
                if (drops[i] * 20 > canvas.height && Math.random() > 0.95) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }
        
        setInterval(drawMatrix, 33);
    }

    // Face Animation
    class FaceAnimation {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.isAnimating = false;
            this.particles = [];
            this.init();
        }
        
        init() {
            this.drawFace();
            this.animate();
        }
        
        drawFace() {
            const ctx = this.ctx;
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00ff41';
            
            // Face circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
            ctx.stroke();
            
            // Eyes
            const eyeY = centerY - 20;
            const eyeSpacing = 35;
            
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing, eyeY, 15, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing, eyeY, 15, 0, Math.PI * 2);
            ctx.stroke();
            
            // Mouth
            if (this.isAnimating) {
                const waveOffset = Math.sin(Date.now() * 0.01) * 5;
                ctx.beginPath();
                ctx.moveTo(centerX - 30, centerY + 40);
                ctx.quadraticCurveTo(centerX, centerY + 40 + waveOffset, centerX + 30, centerY + 40);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(centerX - 20, centerY + 40);
                ctx.lineTo(centerX + 20, centerY + 40);
                ctx.stroke();
            }
            
            if (this.isAnimating) {
                this.updateParticles();
            }
        }
        
        updateParticles() {
            if (Math.random() > 0.7) {
                this.particles.push({
                    x: this.canvas.width / 2 + (Math.random() - 0.5) * 100,
                    y: this.canvas.height / 2 + 60,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 2 - 1,
                    life: 1
                });
            }
            
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                
                if (p.life > 0) {
                    this.ctx.fillStyle = `rgba(0, 255, 65, ${p.life})`;
                    this.ctx.fillRect(p.x, p.y, 2, 2);
                    return true;
                }
                return false;
            });
        }
        
        startSpeaking() {
            this.isAnimating = true;
            voiceIndicator.classList.add('active');
            aikoFaceElement.classList.add('processing');
        }
        
        stopSpeaking() {
            this.isAnimating = false;
            voiceIndicator.classList.remove('active');
            aikoFaceElement.classList.remove('processing');
        }
        
        animate() {
            this.drawFace();
            requestAnimationFrame(() => this.animate());
        }
    }

    // Initialize animations
    const faceAnimation = new FaceAnimation(faceCanvas);
    initMatrixAnimation();

    // Start conversation
    async function startConversation() {
        console.log("Aiko: Avvio conversazione...");
        talkButton.disabled = true;
        endButton.disabled = false;
        isActive = true;
        
        statusDiv.textContent = "Richiesta accesso microfono...";
        
        try {
            // Get microphone access
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Aiko: Microfono OK");
            
            // Create peer connection
            pc = new RTCPeerConnection();
            
            // Set up audio - IMPORTANTE: va fatto PRIMA di createOffer
            pc.ontrack = (event) => {
                console.log("Aiko: Ricevuto audio track da OpenAI");
                aiAudioPlayer.srcObject = event.streams[0];
            };
            
            // Add local audio track
            const audioTrack = localStream.getAudioTracks()[0];
            pc.addTrack(audioTrack, localStream);
            console.log("Aiko: Audio locale aggiunto");
            
            // Create data channel
            dc = pc.createDataChannel("oai-events");
            
            dc.onopen = () => {
                console.log("Aiko: Data channel aperto");
                statusDiv.textContent = "Connesso! Puoi parlare...";
                
                // Configure session
                const sessionUpdate = {
                    type: "session.update",
                    session: {
                        instructions: "Sei Aiko, un'assistente AI estremamente naturale e umana che parla solo italiano. Sii vivace, intelligente ed empatica. Parla in modo naturale e conversazionale.",
                        voice: "shimmer",
                        input_audio_transcription: { model: "whisper-1" },
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 200,
                            create_response: true
                        }
                    }
                };
                dc.send(JSON.stringify(sessionUpdate));
                console.log("Aiko: Session configurata");
                
                // Send initial greeting
                const greeting = {
                    type: "response.create",
                    response: {
                        modalities: ["text", "audio"],
                        instructions: "Saluta calorosamente l'utente e chiedi come puoi aiutarlo oggi."
                    }
                };
                dc.send(JSON.stringify(greeting));
            };
            
            dc.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log("Aiko: Messaggio ricevuto:", message.type);
                
                switch(message.type) {
                    case "response.audio.delta":
                        // Audio is being streamed
                        faceAnimation.startSpeaking();
                        break;
                        
                    case "response.audio.done":
                        // Audio finished
                        faceAnimation.stopSpeaking();
                        break;
                        
                    case "input_audio_buffer.speech_started":
                        statusDiv.textContent = "Ascoltando...";
                        break;
                        
                    case "input_audio_buffer.speech_stopped":
                        statusDiv.textContent = "Elaborando...";
                        break;
                        
                    case "response.done":
                        statusDiv.textContent = "Pronto";
                        break;
                        
                    case "error":
                        console.error("Aiko: Errore:", message);
                        statusDiv.textContent = "Errore: " + message.error?.message;
                        break;
                }
            };
            
            dc.onerror = (error) => {
                console.error("Aiko: Errore data channel:", error);
            };
            
            dc.onclose = () => {
                console.log("Aiko: Data channel chiuso");
                if (isActive) {
                    endConversation();
                }
            };
            
            // Create offer
            statusDiv.textContent = "Connessione con OpenAI...";
            await pc.setLocalDescription();
            console.log("Aiko: Offer creata");
            
            // Send offer to OpenAI
            const response = await fetch(`${REALTIME_API_URL}?model=${MODEL_NAME}`, {
                method: "POST",
                body: pc.localDescription.sdp,
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/sdp"
                }
            });
            
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }
            
            // Set remote description
            const answerSdp = await response.text();
            await pc.setRemoteDescription({
                type: "answer",
                sdp: answerSdp
            });
            console.log("Aiko: Connessione WebRTC stabilita");
            
            // Wait for connection to be established
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Timeout connessione"));
                }, 10000);
                
                pc.onconnectionstatechange = () => {
                    console.log("Aiko: Connection state:", pc.connectionState);
                    if (pc.connectionState === "connected") {
                        clearTimeout(timeout);
                        resolve();
                    } else if (pc.connectionState === "failed") {
                        clearTimeout(timeout);
                        reject(new Error("Connessione fallita"));
                    }
                };
            });
            
            console.log("Aiko: Connessione completata!");
            
        } catch (error) {
            console.error("Aiko: Errore:", error);
            statusDiv.textContent = "Errore: " + error.message;
            endConversation();
        }
    }

    // End conversation
    function endConversation() {
        console.log("Aiko: Chiusura conversazione...");
        isActive = false;
        talkButton.disabled = false;
        endButton.disabled = true;
        faceAnimation.stopSpeaking();
        
        // Stop audio tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Close data channel and peer connection
        if (dc) {
            dc.close();
            dc = null;
        }
        
        if (pc) {
            pc.close();
            pc = null;
        }
        
        statusDiv.textContent = "";
        console.log("Aiko: Sessione chiusa");
    }

    // Event listeners
    talkButton.addEventListener('click', startConversation);
    endButton.addEventListener('click', endConversation);

    // Window resize handler
    window.addEventListener('resize', () => {
        const canvas = matrixCanvasElement.querySelector('canvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

    console.log("Aiko: Pronta!");
}); 