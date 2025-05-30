// Aiko - Conversational AI with Voice
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
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_SUMMARY_API_ENDPOINT = "/api/saveConversationSummary";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";

// WebRTC & Recording
let pc;
let dc;
let ephemeralKeyGlobal;
let webrtcStream = null;
let isActive = false;
let currentConversation = [];
let sessionStartTime = null;

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
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw stylized face outline
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
        
        // Left eye
        ctx.beginPath();
        ctx.arc(centerX - eyeSpacing, eyeY, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        // Right eye
        ctx.beginPath();
        ctx.arc(centerX + eyeSpacing, eyeY, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        // Mouth (changes when speaking)
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
        
        // Add particles when speaking
        if (this.isAnimating) {
            this.updateParticles();
        }
    }
    
    updateParticles() {
        // Add new particles
        if (Math.random() > 0.7) {
            this.particles.push({
                x: this.canvas.width / 2 + (Math.random() - 0.5) * 100,
                y: this.canvas.height / 2 + 60,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2 - 1,
                life: 1
            });
        }
        
        // Update and draw particles
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
        if (!response.ok) return "";
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
            throw new Error(`Errore ${response.status}`);
        }
        
        const data = await response.json();
        return data.client_secret;
    } catch (error) {
        console.error("Errore token:", error);
        throw error;
    }
}

// Start conversation
async function startConversation() {
    talkButton.disabled = true;
    endButton.disabled = false;
    isActive = true;
    currentConversation = [];
    sessionStartTime = new Date();
    
    statusDiv.textContent = "Connessione con Aiko...";
    
    try {
        // Get context and token
        const context = await getInitialContext();
        ephemeralKeyGlobal = await getSessionToken(context);
        
        // Get user media
        webrtcStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Setup WebRTC
        pc = new RTCPeerConnection();
        
        pc.ontrack = (event) => {
            if (event.streams?.[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => console.warn("Audio play error:", e));
            }
        };
        
        webrtcStream.getTracks().forEach(track => {
            pc.addTrack(track, webrtcStream);
        });
        
        // Create data channel
        dc = pc.createDataChannel("oai-events", { ordered: true });
        
        dc.onopen = () => {
            statusDiv.textContent = "Connesso! Puoi parlare...";
            
            // Configure session
            sendEvent({
                type: "session.update",
                session: {
                    turn_detection: { 
                        type: "server_vad", 
                        threshold: 0.5, 
                        silence_duration_ms: 2000, 
                        create_response: true 
                    },
                    tools: [{
                        type: "function",
                        name: "cerca_nella_mia_memoria_personale",
                        description: "Cerca nelle conversazioni passate con Alejandro",
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
            });
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
            console.log("Data channel closed");
            if (isActive) {
                endConversation();
            }
        };
        
        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL_NAME}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                "Authorization": `Bearer ${ephemeralKeyGlobal}`,
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
        
    } catch (error) {
        console.error("Errore avvio:", error);
        statusDiv.textContent = "Errore connessione";
        endConversation();
    }
}

// Handle server events
function handleServerEvent(event) {
    switch (event.type) {
        case "response.audio_transcript.delta":
            if (event.delta) {
                appendToConversation("AI", event.delta, event.item_id);
            }
            break;
            
        case "conversation.item.created":
            if (event.item?.role === "user" && event.item?.formatted?.transcript) {
                addToConversation("Tu", event.item.formatted.transcript);
            }
            break;
            
        case "response.audio.started":
            faceAnimation.startSpeaking();
            break;
            
        case "response.audio.done":
            faceAnimation.stopSpeaking();
            break;
            
        case "response.function_call_arguments.start":
            if (event.name === "cerca_nella_mia_memoria_personale") {
                statusDiv.textContent = "Cerco nei ricordi...";
            }
            break;
            
        case "response.function_call_arguments.done":
            if (event.name === "cerca_nella_mia_memoria_personale") {
                handleMemorySearch(event);
            }
            break;
    }
}

// Memory search
async function handleMemorySearch(event) {
    try {
        const args = JSON.parse(event.arguments);
        const searchQuery = args.termini_di_ricerca;
        
        const response = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?query=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        
        sendEvent({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: event.call_id,
                output: data.results || "Nessun ricordo trovato."
            }
        });
        
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

// Send event to OpenAI
function sendEvent(event) {
    if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify(event));
    }
}

// End conversation and save summary
async function endConversation() {
    isActive = false;
    talkButton.disabled = false;
    endButton.disabled = true;
    faceAnimation.stopSpeaking();
    
    // Save conversation summary if there was content
    if (currentConversation.length > 0) {
        statusDiv.textContent = "Salvo il riassunto della conversazione...";
        
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
            }
        } catch (e) {
            console.error("Errore salvataggio:", e);
        }
    }
    
    // Cleanup
    if (webrtcStream) {
        webrtcStream.getTracks().forEach(track => track.stop());
        webrtcStream = null;
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