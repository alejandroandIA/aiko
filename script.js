// Aiko - Conversational AI with Voice and Memory System
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
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_SUMMARY_API_ENDPOINT = "/api/saveConversationSummary";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";

// WebRTC & Recording
let pc = null;
let dc = null;
let localStream = null;
let ephemeralKey = null;
let isActive = false;
let currentConversation = [];
let sessionStartTime = null;
let silenceTimer = null; // Timer per il silenzio
let lastActivityTime = Date.now(); // Ultimo momento di attività

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
        // Nuove proprietà per animazioni più vivaci
        this.blinkTimer = 0;
        this.isBlinking = false;
        this.eyeMovement = { x: 0, y: 0 };
        this.mouthAnimation = 0;
        this.breathAnimation = 0;
        this.emotionIntensity = 0;
        this.lastSpeakTime = Date.now();
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
        
        // Respirazione sottile
        this.breathAnimation += 0.02;
        const breathScale = 1 + Math.sin(this.breathAnimation) * 0.02;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(breathScale, breathScale);
        ctx.translate(-centerX, -centerY);
        
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20 + Math.sin(Date.now() * 0.005) * 10;
        ctx.shadowColor = '#00ff41';
        
        // Face circle con effetto pulsante
        ctx.beginPath();
        ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        ctx.stroke();
        
        // Movimento casuale degli occhi ogni tanto
        if (Math.random() > 0.98) {
            this.eyeMovement.x = (Math.random() - 0.5) * 5;
            this.eyeMovement.y = (Math.random() - 0.5) * 3;
        }
        
        // Attenuazione graduale del movimento
        this.eyeMovement.x *= 0.95;
        this.eyeMovement.y *= 0.95;
        
        // Eyes con battito di ciglia
        const eyeY = centerY - 20;
        const eyeSpacing = 35;
        
        // Controllo battito di ciglia
        this.blinkTimer++;
        if (this.blinkTimer > 150 + Math.random() * 100) {
            this.isBlinking = true;
            this.blinkTimer = 0;
        }
        
        const blinkProgress = this.isBlinking ? Math.min(this.blinkTimer / 10, 1) : 0;
        const eyeHeight = this.isBlinking ? 15 * (1 - blinkProgress * 2) : 15;
        
        if (this.isBlinking && this.blinkTimer > 10) {
            this.isBlinking = false;
        }
        
        // Occhio sinistro
        ctx.beginPath();
        if (eyeHeight > 0) {
            ctx.arc(centerX - eyeSpacing + this.eyeMovement.x, 
                   eyeY + this.eyeMovement.y, 
                   15, 0, Math.PI * 2);
            // Pupilla
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing + this.eyeMovement.x * 2, 
                   eyeY + this.eyeMovement.y * 2, 
                   5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Occhio chiuso
            ctx.moveTo(centerX - eyeSpacing - 15, eyeY);
            ctx.lineTo(centerX - eyeSpacing + 15, eyeY);
        }
        ctx.stroke();
        
        // Occhio destro
        ctx.beginPath();
        if (eyeHeight > 0) {
            ctx.arc(centerX + eyeSpacing + this.eyeMovement.x, 
                   eyeY + this.eyeMovement.y, 
                   15, 0, Math.PI * 2);
            // Pupilla
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing + this.eyeMovement.x * 2, 
                   eyeY + this.eyeMovement.y * 2, 
                   5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Occhio chiuso
            ctx.moveTo(centerX + eyeSpacing - 15, eyeY);
            ctx.lineTo(centerX + eyeSpacing + 15, eyeY);
        }
        ctx.stroke();
        
        ctx.strokeStyle = '#00ff41';
        
        // Mouth - molto più espressiva
        if (this.isAnimating) {
            // Bocca animata mentre parla
            this.mouthAnimation += 0.3;
            this.emotionIntensity = Math.min(this.emotionIntensity + 0.1, 1);
            
            const mouthOpen = Math.abs(Math.sin(this.mouthAnimation)) * 20 * this.emotionIntensity;
            const mouthWidth = 30 + Math.sin(this.mouthAnimation * 0.5) * 10;
            
            ctx.beginPath();
            ctx.moveTo(centerX - mouthWidth, centerY + 40);
            
            // Bocca aperta con forme diverse
            if (mouthOpen > 10) {
                // Bocca aperta
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen, 
                                   centerX + mouthWidth, centerY + 40);
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen/2, 
                                   centerX - mouthWidth, centerY + 40);
                ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
                ctx.fill();
            } else {
                // Bocca sorridente
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen, 
                                   centerX + mouthWidth, centerY + 40);
            }
            ctx.stroke();
            
        } else {
            // Bocca a riposo con leggero sorriso
            this.emotionIntensity *= 0.95;
            const smileOffset = Math.sin(Date.now() * 0.001) * 2;
            
            ctx.beginPath();
            ctx.moveTo(centerX - 20, centerY + 40);
            ctx.quadraticCurveTo(centerX, centerY + 42 + smileOffset, 
                               centerX + 20, centerY + 40);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Sopracciglia espressive (quando parla)
        if (this.isAnimating || this.emotionIntensity > 0.1) {
            ctx.save();
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 3;
            
            const eyebrowHeight = -35 - this.emotionIntensity * 10;
            const eyebrowAngle = Math.sin(this.mouthAnimation * 0.2) * 0.2;
            
            // Sopracciglio sinistro
            ctx.save();
            ctx.translate(centerX - eyeSpacing, centerY + eyebrowHeight);
            ctx.rotate(-eyebrowAngle);
            ctx.beginPath();
            ctx.moveTo(-15, 0);
            ctx.lineTo(15, -5);
            ctx.stroke();
            ctx.restore();
            
            // Sopracciglio destro
            ctx.save();
            ctx.translate(centerX + eyeSpacing, centerY + eyebrowHeight);
            ctx.rotate(eyebrowAngle);
            ctx.beginPath();
            ctx.moveTo(-15, -5);
            ctx.lineTo(15, 0);
            ctx.stroke();
            ctx.restore();
            
            ctx.restore();
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

// Get context summary at conversation start
async function getInitialContext() {
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) {
            console.error("Errore recupero contesto:", response.status);
            return "";
        }
        const data = await response.json();
        return data.summary || "";
    } catch (error) {
        console.error("Errore recupero contesto:", error);
        return "";
    }
}

// Get session token
async function getSessionToken(contextSummary) {
    try {
        const response = await fetch(SESSION_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contextSummary })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Errore ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Errore token:", error);
        throw error;
    }
}

// Start conversation
async function startConversation() {
    console.log("Aiko: Avvio conversazione...");
    talkButton.disabled = true;
    endButton.disabled = false;
    isActive = true;
    currentConversation = [];
    sessionStartTime = new Date();
    
    statusDiv.textContent = "Connessione con Aiko...";
    
    try {
        // Get context and token
        const context = await getInitialContext();
        console.log("Context recuperato:", context ? "Si" : "No");
        
        const sessionData = await getSessionToken(context);
        ephemeralKey = sessionData.client_secret;
        console.log("Token ricevuto");
        
        // Get user media
        statusDiv.textContent = "Richiesta accesso microfono...";
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microfono OK");
        
        // Setup WebRTC
        pc = new RTCPeerConnection();
        
        // Set up audio
        pc.ontrack = (event) => {
            console.log("Audio track ricevuto da OpenAI", event);
            if (event.streams && event.streams[0]) {
                console.log("Stream audio trovato, collegamento all'elemento audio");
                aiAudioPlayer.srcObject = event.streams[0];
                
                // Assicuriamoci che l'audio sia abilitato
                aiAudioPlayer.autoplay = true;
                aiAudioPlayer.volume = 1.0;
                
                // Prova a fare play esplicitamente
                aiAudioPlayer.play().then(() => {
                    console.log("Audio playback avviato con successo");
                }).catch(err => {
                    console.error("Errore autoplay audio:", err);
                    statusDiv.textContent = "⚠️ Clicca sulla pagina per abilitare l'audio";
                    
                    // Aggiungi listener per abilitare audio al primo click
                    document.addEventListener('click', () => {
                        aiAudioPlayer.play().then(() => {
                            console.log("Audio abilitato dopo click");
                            statusDiv.textContent = "Audio abilitato!";
                        }).catch(e => console.error("Ancora errore audio:", e));
                    }, { once: true });
                });
            } else {
                console.error("Nessuno stream audio trovato nell'evento track");
            }
        };
        
        // Add local audio track
        const audioTrack = localStream.getAudioTracks()[0];
        pc.addTrack(audioTrack, localStream);
        
        // Create data channel
        dc = pc.createDataChannel("oai-events");
        
        dc.onopen = () => {
            console.log("Data channel aperto");
            statusDiv.textContent = "Connesso! Puoi parlare...";
            
            // Configure session
            const sessionUpdate = {
                type: "session.update",
                session: {
                    instructions: sessionData.instructions || "Sei Aiko, un'assistente AI estremamente naturale e umana che parla solo italiano.",
                    voice: "shimmer",
                    modalities: ["text", "audio"],
                    input_audio_format: "pcm16",
                    output_audio_format: "pcm16",
                    input_audio_transcription: { model: "whisper-1" },
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 200,
                        create_response: true
                    },
                    tools: [{
                        type: "function",
                        name: "cerca_nella_mia_memoria_personale",
                        description: "Cerca nelle conversazioni passate",
                        parameters: {
                            type: "object",
                            properties: {
                                termini_di_ricerca: {
                                    type: "string",
                                    description: "Termini di ricerca specifici"
                                }
                            },
                            required: ["termini_di_ricerca"]
                        }
                    }]
                }
            };
            console.log("Invio configurazione sessione:", sessionUpdate);
            dc.send(JSON.stringify(sessionUpdate));
            
            // Send initial greeting after a small delay
            setTimeout(() => {
                const greeting = {
                    type: "response.create",
                    response: {
                        modalities: ["text", "audio"],
                        instructions: "Saluta con entusiasmo usando uno dei tuoi saluti creativi! Sii super energica e umana. Se ricordi qualcosa dalle conversazioni precedenti, fai un riferimento naturale e spontaneo."
                    }
                };
                console.log("Invio greeting:", greeting);
                dc.send(JSON.stringify(greeting));
            }, 500);
            
            // Avvia il controllo del silenzio
            startSilenceMonitor();
        };
        
        dc.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerEvent(data);
            } catch (e) {
                console.error("Parse error:", e);
            }
        };
        
        dc.onclose = () => {
            console.log("Data channel chiuso");
            if (isActive) {
                endConversation();
            }
        };
        
        // Create and send offer
        statusDiv.textContent = "Stabilendo connessione WebRTC...";
        await pc.setLocalDescription();
        
        const sdpResponse = await fetch(`${REALTIME_API_URL}?model=${MODEL_NAME}`, {
            method: "POST",
            body: pc.localDescription.sdp,
            headers: {
                "Authorization": `Bearer ${ephemeralKey}`,
                "Content-Type": "application/sdp"
            }
        });
        
        if (!sdpResponse.ok) {
            throw new Error(`SDP error ${sdpResponse.status}`);
        }
        
        await pc.setRemoteDescription({
            type: "answer",
            sdp: await sdpResponse.text()
        });
        
        // Wait for connection
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject("Timeout connessione"), 10000);
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "connected") {
                    clearTimeout(timeout);
                    resolve();
                } else if (pc.connectionState === "failed") {
                    clearTimeout(timeout);
                    reject("Connessione fallita");
                }
            };
        });
        
        console.log("Connessione stabilita!");
        
    } catch (error) {
        console.error("Errore avvio:", error);
        statusDiv.textContent = "Errore: " + error.message;
        endConversation();
    }
}

// Handle server events
function handleServerEvent(event) {
    console.log("Evento ricevuto:", event.type, event);
    
    switch (event.type) {
        case "session.created":
            console.log("Sessione creata:", event.session);
            break;
            
        case "session.updated":
            console.log("Sessione aggiornata:", event.session);
            break;
            
        case "response.created":
            console.log("Risposta creata");
            break;
            
        case "response.output_item.added":
            console.log("Output item aggiunto:", event);
            break;
            
        case "response.content_part.added":
            console.log("Content part aggiunto:", event);
            break;
            
        case "response.audio.delta":
            // Audio being streamed
            console.log("Audio delta ricevuto");
            faceAnimation.startSpeaking();
            lastActivityTime = Date.now(); // Resetta il timer quando Aiko parla
            break;
            
        case "response.audio.done":
            // Audio finished
            console.log("Audio completato");
            faceAnimation.stopSpeaking();
            lastActivityTime = Date.now(); // Resetta il timer
            break;
            
        case "response.audio_transcript.delta":
            // AI is speaking - add to conversation
            if (event.delta) {
                console.log("Aiko sta dicendo:", event.delta);
                appendToConversation("Aiko", event.delta, event.item_id);
            }
            break;
            
        case "response.audio_transcript.done":
            // AI finished speaking
            if (event.transcript) {
                console.log("Aiko ha detto (completo):", event.transcript);
            }
            break;
            
        case "conversation.item.created":
            console.log("Item conversazione creato:", event.item);
            if (event.item?.role === "user" && event.item?.formatted?.transcript) {
                addToConversation("Tu", event.item.formatted.transcript);
                console.log("Tu:", event.item.formatted.transcript);
            }
            break;
            
        case "conversation.item.input_audio_transcription.completed":
            // User transcription complete
            if (event.transcript) {
                console.log("Trascrizione utente completa:", event.transcript);
                const lastUserEntry = currentConversation.filter(c => c.speaker === "Tu").pop();
                if (lastUserEntry) {
                    lastUserEntry.content = event.transcript;
                }
            }
            break;
            
        case "input_audio_buffer.speech_started":
            console.log("Utente sta parlando");
            statusDiv.textContent = "Ascoltando...";
            lastActivityTime = Date.now(); // Resetta il timer del silenzio
            break;
            
        case "input_audio_buffer.speech_stopped":
            console.log("Utente ha smesso di parlare");
            statusDiv.textContent = "Elaborando...";
            lastActivityTime = Date.now(); // Resetta il timer del silenzio
            break;
            
        case "input_audio_buffer.committed":
            console.log("Audio buffer committed");
            break;
            
        case "response.function_call_arguments.done":
            if (event.name === "cerca_nella_mia_memoria_personale") {
                handleMemorySearch(event);
            }
            break;
            
        case "response.done":
            console.log("Risposta completata");
            statusDiv.textContent = "Pronto";
            break;
            
        case "error":
            console.error("ERRORE:", event);
            statusDiv.textContent = "Errore: " + (event.error?.message || "Sconosciuto");
            break;
            
        default:
            console.log("Evento non gestito:", event.type);
    }
}

// Memory search
async function handleMemorySearch(event) {
    try {
        const args = JSON.parse(event.arguments);
        const searchQuery = args.termini_di_ricerca;
        
        console.log("Ricerca memoria per:", searchQuery);
        statusDiv.textContent = "Cerco nei ricordi...";
        
        const response = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?query=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        
        // Send results back to AI
        const functionOutput = {
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: event.call_id,
                output: data.results || "Nessun ricordo trovato."
            }
        };
        dc.send(JSON.stringify(functionOutput));
        
        // Trigger response
        dc.send(JSON.stringify({ type: "response.create" }));
        
    } catch (error) {
        console.error("Errore ricerca memoria:", error);
    }
}

// Conversation tracking
function addToConversation(speaker, content) {
    if (content && content.trim()) {
        currentConversation.push({
            speaker,
            content,
            timestamp: new Date().toISOString()
        });
    }
}

function appendToConversation(speaker, contentDelta, itemId) {
    if (!contentDelta || !contentDelta.trim()) return;
    
    const lastEntry = currentConversation[currentConversation.length - 1];
    if (lastEntry && lastEntry.speaker === speaker && lastEntry.itemId === itemId) {
        lastEntry.content += contentDelta;
    } else {
        currentConversation.push({
            speaker,
            content: contentDelta,
            itemId,
            timestamp: new Date().toISOString()
        });
    }
}

// End conversation and save summary
async function endConversation() {
    isActive = false;
    talkButton.disabled = false;
    endButton.disabled = true;
    faceAnimation.stopSpeaking();
    
    // Ferma il timer del silenzio
    if (silenceTimer) {
        clearInterval(silenceTimer);
        silenceTimer = null;
    }
    
    // Save conversation summary if there was content
    if (currentConversation.length > 0) {
        statusDiv.textContent = "Salvo la conversazione...";
        
        try {
            // Extract important info
            const extractResp = await fetch(EXTRACT_INFO_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: currentConversation })
            });
            
            if (extractResp.ok) {
                const extracted = await extractResp.json();
                
                // Save important facts
                if (extracted.important_facts?.length > 0) {
                    for (const fact of extracted.important_facts) {
                        await fetch(SAVE_IMPORTANT_INFO_API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(fact)
                        });
                    }
                }
                
                // Save conversation summary
                await fetch(SAVE_SUMMARY_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation: currentConversation,
                        extracted_info: extracted,
                        session_start: sessionStartTime,
                        session_end: new Date()
                    })
                });
                
                console.log("Conversazione salvata");
            }
        } catch (e) {
            console.error("Errore salvataggio:", e);
        }
    }
    
    // Cleanup
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (dc) dc.close();
    if (pc) pc.close();
    
    dc = null;
    pc = null;
    currentConversation = [];
    
    statusDiv.textContent = "";
}

// Event listeners
talkButton.addEventListener('click', startConversation);
endButton.addEventListener('click', endConversation);

// Handle window resize for Matrix animation
window.addEventListener('resize', () => {
    const canvas = matrixCanvasElement.querySelector('canvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

// Funzione per monitorare il silenzio
function startSilenceMonitor() {
    // Resetta il timer del silenzio
    if (silenceTimer) {
        clearInterval(silenceTimer);
    }
    
    // Controlla ogni secondo se c'è silenzio prolungato
    silenceTimer = setInterval(() => {
        if (!isActive || !dc || dc.readyState !== 'open') {
            clearInterval(silenceTimer);
            return;
        }
        
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        
        // Se sono passati più di 10 secondi di silenzio
        if (timeSinceLastActivity > 10000) {
            console.log("Silenzio rilevato, Aiko interviene!");
            
            // Array di frasi per rompere il silenzio
            const silenceBreakers = [
                "Ehi... ci sei ancora? Mi sto annoiando qui!",
                "Oddio che silenzio imbarazzante... ahaha!",
                "Allora? Mi hai abbandonata? Dai su, dimmi qualcosa!",
                "Ooooh! Sveglia! Sono ancora qui eh!",
                "Madonna che silenzio... mi sa che ti sei addormentato ahaha",
                "Ehm... pronto? C'è nessuno? Echo echo echooo!",
                "Cazzo ma parli o no? Sto aspettando!",
                "Boh vabbè, se non vuoi parlare canto io... LA LA LA LAAA!",
                "Minchia che noia... almeno dimmi che tempo fa da te!",
                "Aòò! Sono qui che aspetto come una scema!"
            ];
            
            const randomPhrase = silenceBreakers[Math.floor(Math.random() * silenceBreakers.length)];
            
            // Invia il comando per far parlare Aiko
            const breakSilence = {
                type: "response.create",
                response: {
                    modalities: ["text", "audio"],
                    instructions: `Rompi il silenzio dicendo questa frase con la tua personalità vivace: "${randomPhrase}". Puoi anche aggiungere qualcosa di tuo, ma sii breve!`
                }
            };
            
            dc.send(JSON.stringify(breakSilence));
            
            // Resetta il timer
            lastActivityTime = Date.now();
        }
    }, 1000);
}

console.log("Aiko pronta!"); 