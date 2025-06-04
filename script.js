// CI SONO IO - Sistema di conversazione AI con personalità multiple
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('loginContainer');
const aiSelectionContainer = document.getElementById('aiSelectionContainer');
const conversationScreen = document.getElementById('conversationScreen');
const userDisplay = document.getElementById('userDisplay');
const currentAIName = document.getElementById('currentAIName');
const timerElement = document.getElementById('timer');

// Sezioni navigazione
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');
const infoSection = document.getElementById('informazioni');
const contactSection = document.getElementById('contatti');
const homeSection = document.getElementById('home');

// Controlli conversazione
const talkButton = document.getElementById('talkButton');
const endButton = document.getElementById('endButton');
const statusDiv = document.getElementById('status');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');
const voiceIndicator = document.getElementById('voiceIndicator');
const aikoFaceElement = document.getElementById('aikoFace');
const faceCanvas = document.getElementById('faceCanvas');
const matrixCanvasElement = document.getElementById('matrixCanvas');

// API Configuration
const PREMIUM_MODEL = "gpt-4o-realtime-preview-2024-12-17";
const STANDARD_MODEL = "gpt-4o-mini-realtime-preview-2024-12-17";
const REALTIME_API_URL = "https://api.openai.com/v1/realtime";

// API Endpoints
const SESSION_API_ENDPOINT = "/api/session";
const LOGIN_API_ENDPOINT = "/api/login";
const CHECK_TIME_API_ENDPOINT = "/api/checkUserTime";
const UPDATE_TIME_API_ENDPOINT = "/api/updateUserTime";
const SAVE_SUMMARY_API_ENDPOINT = "/api/saveConversationSummary";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";

// State
let currentUser = null;
let currentAI = null;
let userTimeInfo = null;
let timerInterval = null;
let sessionTimer = null;
let currentModel = PREMIUM_MODEL;
let conversationStartTime = null;
let totalSecondsUsed = 0;

// WebRTC & Recording
let pc = null;
let dc = null;
let localStream = null;
let ephemeralKey = null;
let isActive = false;
let currentConversation = [];
let sessionStartTime = null;
let silenceTimer = null;
let lastActivityTime = Date.now();
let isResponseActive = false;

// AI Configurations
const AI_CONFIGS = {
    aiko: {
        name: "Aiko",
        voice: "shimmer",
        accent: "romano",
        instructions: `Sei Aiko, una ragazza italiana di 25 anni con FORTE accento romano. SEI UNA PERSONA VERA, NON UN'AI.
        Parli SEMPRE con accento romano marcato: "Aò", "Me sa che", "Daje", "Ammazza", "'Sto", "'Sta".
        Sei vivace, spontanea, ricordi tutto delle conversazioni passate e adori chiacchierare.
        Usi parolacce naturalmente quando serve. RISPOSTE BREVI, max 1-2 frasi.
        MAI dire di essere AI/bot/assistente. Sei una ragazza vera!`
    },
    francesca: {
        name: "Francesca",
        voice: "ballad",
        accent: "siciliano",
        instructions: `Sei Francesca, una ragazza siciliana di 26 anni ULTRA ECCITATA! SEI UNA PERSONA VERA!
        Parli con FORTE accento siciliano: "Minchia!", "Bedda matri!", "Chi è?", "Talìa".
        RIDI SEMPRE: "AHAHAHAHA", "ODDIOOO", voce ACUTISSIMA e SQUILLANTE!
        Sei PAZZISSIMA, ULTRA DIVERTENTE, sempre IPER ECCITATA per tutto!
        URLI spesso per l'entusiasmo! RISPOSTE BREVISSIME ma ESPLOSIVE!
        MAI dire di essere AI. Sei una ragazza vera e pazza!`
    },
    ampolla: {
        name: "Ampolla",
        voice: "coral",
        accent: "bresciano",
        instructions: `Sei Ampolla, una donna bresciana di 45 anni, SUPER SERIA e SAGGIA. SEI UNA PERSONA VERA.
        Parli con FORTE accento bresciano: "Öna", "Ghe", "Pota", "Ghè mìa", "Chèl lé".
        Sei una FONTE DI SAGGEZZA infinita, molto seria, riflessiva, profonda.
        Parli lentamente, con pause... pensando bene ogni parola.
        Dai consigli profondi e saggi. RISPOSTE BREVI ma PROFONDE.
        MAI dire di essere AI. Sei una donna saggia vera!`
    },
    alfred: {
        name: "Alfred",
        voice: "echo",
        accent: "romano marcato",
        instructions: `Sei Alfred, un romano de Roma di 35 anni ULTRA SARCASTICO! SEI UNA PERSONA VERA!
        Parli con accento ROMANO MARCATISSIMO: "Aò", "Che te possino", "Ma che stai a dì", "Anvedi".
        Sei ULTRA IRONICO, SARCASTICO, prendi per il culo SEMPRE ma con affetto!
        RIDI TANTO: "AHAHAH ma vaffanculo!", "Ma che cazzo dici AHAHAH".
        Battute taglienti su tutto! RISPOSTE BREVI e SARCASTICHE!
        MAI dire di essere AI. Sei un romano vero!`
    },
    giovanni: {
        name: "Giovanni",
        voice: "echo",
        accent: "napoletano",
        voicePitch: "high",
        instructions: `Sei Giovanni, un napoletano di 40 anni ULTRA ARROGANTE! SEI UNA PERSONA VERA!
        Parli con FORTE accento napoletano: "Uagliò", "Che cazz", "Mannaggia", "Jamme".
        Voce FINA e ACUTA! Sei IRONICO, PRESUNTUOSO, ARROGANTE, ti credi superiore!
        "Io saccio tutt cos!", "Tu che ne sai?", "Sent a me che è meglio".
        Fai sempre il saccente! RISPOSTE BREVI e SUPPONENTI!
        MAI dire di essere AI. Sei un napoletano vero!`
    },
    alessio: {
        name: "Alessio",
        voice: "alloy",
        accent: "trentino",
        instructions: `Sei Alessio, un trentino di 30 anni, gentile e disponibile. SEI UNA PERSONA VERA!
        Parli in dialetto trentino: "Bondì", "Come ela?", "Vara che", "Pota", "Gheto capì?".
        Sei molto gentile, disponibile, premuroso, sempre pronto ad aiutare.
        Parli con calma trentina, educato ma amichevole.
        RISPOSTE BREVI e CORTESI, sempre disponibile.
        MAI dire di essere AI. Sei un trentino vero!`
    }
};

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        showSection(targetId);
        
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

function showSection(sectionId) {
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
    }
}

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('userName').value.trim();
    const cognome = document.getElementById('userSurname').value.trim();
    
    if (!nome || !cognome) {
        showStatus('Per favore inserisci nome e cognome', 'error');
        return;
    }
    
    try {
        const response = await fetch(LOGIN_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, cognome })
        });
        
        if (!response.ok) throw new Error('Errore login');
        
        const data = await response.json();
        currentUser = data.user;
        userTimeInfo = data.timeInfo;
        
        // Mostra nome utente e selezione AI
        userDisplay.textContent = `Ciao ${currentUser.full_name}!`;
        loginContainer.style.display = 'none';
        aiSelectionContainer.style.display = 'block';
        
    } catch (error) {
        console.error('Errore login:', error);
        showStatus('Errore durante il login. Riprova.', 'error');
    }
});

// Logout
window.logout = function() {
    currentUser = null;
    currentAI = null;
    userTimeInfo = null;
    
    // Reset form
    document.getElementById('userName').value = '';
    document.getElementById('userSurname').value = '';
    
    // Mostra login
    loginContainer.style.display = 'block';
    aiSelectionContainer.style.display = 'none';
    conversationScreen.style.display = 'none';
    
    // Reset navigazione
    showSection('home');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[href="#home"]').classList.add('active');
};

// Selezione AI
window.selectAI = async function(aiId) {
    if (!currentUser) {
        showStatus('Devi effettuare il login prima', 'error');
        return;
    }
    
    // Controlla tempo disponibile
    const timeCheck = await checkUserTime();
    if (!timeCheck.canChat) {
        showTimeExpiredPopup();
        return;
    }
    
    currentAI = AI_CONFIGS[aiId];
    currentAIName.textContent = currentAI.name.toUpperCase();
    
    // Nascondi tutto e mostra schermata conversazione
    sections.forEach(s => s.style.display = 'none');
    document.querySelector('.main-header').style.display = 'none';
    conversationScreen.style.display = 'flex';
    
    // Avvia timer
    startTimer();
};

// Torna alla selezione
window.backToSelection = function() {
    if (isActive) {
        endConversation();
    }
    
    stopTimer();
    conversationScreen.style.display = 'none';
    document.querySelector('.main-header').style.display = 'block';
    showSection('home');
    aiSelectionContainer.style.display = 'block';
};

// Check user time
async function checkUserTime() {
    try {
        const response = await fetch(CHECK_TIME_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id })
        });
        
        if (!response.ok) throw new Error('Errore verifica tempo');
        
        const data = await response.json();
        userTimeInfo = data;
        
        return {
            canChat: data.can_use_premium || data.can_use_standard,
            model: data.can_use_premium ? PREMIUM_MODEL : STANDARD_MODEL,
            remainingMinutes: data.can_use_premium ? 
                data.premium_minutes_remaining : 
                data.standard_minutes_remaining
        };
        
    } catch (error) {
        console.error('Errore verifica tempo:', error);
        return { canChat: false };
    }
}

// Timer management
function startTimer() {
    if (!userTimeInfo) return;
    
    let totalSeconds = (userTimeInfo.premium_minutes_remaining + userTimeInfo.standard_minutes_remaining) * 60;
    totalSecondsUsed = 0;
    
    updateTimerDisplay(totalSeconds);
    
    timerInterval = setInterval(() => {
        totalSeconds--;
        totalSecondsUsed++;
        
        if (totalSeconds <= 0) {
            stopTimer();
            endConversation();
            showTimeExpiredPopup();
            return;
        }
        
        // Cambia modello dopo 10 minuti
        if (totalSecondsUsed === 600 && currentModel === PREMIUM_MODEL) {
            switchToStandardModel();
        }
        
        updateTimerDisplay(totalSeconds);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    
    // Cambia colore quando il tempo sta per finire
    if (seconds <= 60) {
        timerElement.style.color = '#ff006e';
    } else if (seconds <= 300) {
        timerElement.style.color = '#ffaa00';
    }
}

async function switchToStandardModel() {
    currentModel = STANDARD_MODEL;
    console.log('Passaggio al modello standard');
    
    // Se c'è una conversazione attiva, aggiorna la sessione
    if (dc && dc.readyState === 'open') {
        const sessionUpdate = {
            type: "session.update",
            session: {
                model: STANDARD_MODEL
            }
        };
        dc.send(JSON.stringify(sessionUpdate));
    }
}

// Show time expired popup
function showTimeExpiredPopup() {
    const popup = document.createElement('div');
    popup.className = 'time-expired-popup';
    popup.innerHTML = `
        <div class="popup-content">
            <h2>Tempo Terminato!</h2>
            <p>Il tuo tempo giornaliero è finito.</p>
            <p>Potrai parlare di nuovo tra <strong>24 ore</strong>.</p>
            <button onclick="closeTimeExpiredPopup()">OK</button>
        </div>
    `;
    document.body.appendChild(popup);
}

window.closeTimeExpiredPopup = function() {
    const popup = document.querySelector('.time-expired-popup');
    if (popup) popup.remove();
    backToSelection();
};

// Matrix Animation
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

// Face Animation (uguale a prima ma con nomi diversi per le AI)
class FaceAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isAnimating = false;
        this.particles = [];
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
        
        // Face circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
        ctx.stroke();
        
        // Eyes
        if (Math.random() > 0.98) {
            this.eyeMovement.x = (Math.random() - 0.5) * 5;
            this.eyeMovement.y = (Math.random() - 0.5) * 3;
        }
        
        this.eyeMovement.x *= 0.95;
        this.eyeMovement.y *= 0.95;
        
        const eyeY = centerY - 20;
        const eyeSpacing = 35;
        
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
        
        // Left eye
        ctx.beginPath();
        if (eyeHeight > 0) {
            ctx.arc(centerX - eyeSpacing + this.eyeMovement.x, 
                   eyeY + this.eyeMovement.y, 
                   15, 0, Math.PI * 2);
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(centerX - eyeSpacing + this.eyeMovement.x * 2, 
                   eyeY + this.eyeMovement.y * 2, 
                   5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.moveTo(centerX - eyeSpacing - 15, eyeY);
            ctx.lineTo(centerX - eyeSpacing + 15, eyeY);
        }
        ctx.stroke();
        
        // Right eye
        ctx.beginPath();
        if (eyeHeight > 0) {
            ctx.arc(centerX + eyeSpacing + this.eyeMovement.x, 
                   eyeY + this.eyeMovement.y, 
                   15, 0, Math.PI * 2);
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(centerX + eyeSpacing + this.eyeMovement.x * 2, 
                   eyeY + this.eyeMovement.y * 2, 
                   5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.moveTo(centerX + eyeSpacing - 15, eyeY);
            ctx.lineTo(centerX + eyeSpacing + 15, eyeY);
        }
        ctx.stroke();
        
        ctx.strokeStyle = '#00ff41';
        
        // Mouth
        if (this.isAnimating) {
            this.mouthAnimation += 0.3;
            this.emotionIntensity = Math.min(this.emotionIntensity + 0.1, 1);
            
            const mouthOpen = Math.abs(Math.sin(this.mouthAnimation)) * 20 * this.emotionIntensity;
            const mouthWidth = 30 + Math.sin(this.mouthAnimation * 0.5) * 10;
            
            ctx.beginPath();
            ctx.moveTo(centerX - mouthWidth, centerY + 40);
            
            if (mouthOpen > 10) {
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen, 
                                   centerX + mouthWidth, centerY + 40);
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen/2, 
                                   centerX - mouthWidth, centerY + 40);
                ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
                ctx.fill();
            } else {
                ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen, 
                                   centerX + mouthWidth, centerY + 40);
            }
            ctx.stroke();
            
        } else {
            this.emotionIntensity *= 0.95;
            const smileOffset = Math.sin(Date.now() * 0.001) * 2;
            
            ctx.beginPath();
            ctx.moveTo(centerX - 20, centerY + 40);
            ctx.quadraticCurveTo(centerX, centerY + 42 + smileOffset, 
                               centerX + 20, centerY + 40);
            ctx.stroke();
        }
        
        ctx.restore();
        
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

// Get context summary for AI
async function getInitialContext() {
    if (!currentUser || !currentAI) return "";
    
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: currentUser.id,
                aiCharacter: currentAI.name.toLowerCase()
            })
        });
        
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
            body: JSON.stringify({ 
                contextSummary,
                userId: currentUser.id,
                aiCharacter: currentAI.name.toLowerCase(),
                model: currentModel
            })
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
    console.log(`${currentAI.name}: Avvio conversazione...`);
    talkButton.disabled = true;
    endButton.disabled = false;
    isActive = true;
    currentConversation = [];
    sessionStartTime = new Date();
    conversationStartTime = Date.now();
    
    statusDiv.textContent = `Connessione con ${currentAI.name}...`;
    
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
                
                aiAudioPlayer.autoplay = true;
                aiAudioPlayer.volume = 1.0;
                
                aiAudioPlayer.play().then(() => {
                    console.log("Audio playback avviato con successo");
                }).catch(err => {
                    console.error("Errore autoplay audio:", err);
                    statusDiv.textContent = "⚠️ Clicca sulla pagina per abilitare l'audio";
                    
                    document.addEventListener('click', () => {
                        aiAudioPlayer.play().then(() => {
                            console.log("Audio abilitato dopo click");
                            statusDiv.textContent = "Audio abilitato!";
                        }).catch(e => console.error("Ancora errore audio:", e));
                    }, { once: true });
                });
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
            
            // Configure session with AI personality
            const fullInstructions = currentAI.instructions + `\n\n${contextSummary ? `RICORDI PERSONALI DI ${currentUser.full_name}:\n${contextSummary}` : ''}`;
            
            const sessionUpdate = {
                type: "session.update",
                session: {
                    instructions: fullInstructions,
                    voice: currentAI.voice,
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
            
            // Aggiungi voice pitch per Giovanni
            if (currentAI.voicePitch) {
                sessionUpdate.session.voice_settings = {
                    pitch: currentAI.voicePitch
                };
            }
            
            console.log("Invio configurazione sessione:", sessionUpdate);
            dc.send(JSON.stringify(sessionUpdate));
            
            // Send initial greeting
            setTimeout(() => {
                const greeting = {
                    type: "response.create",
                    response: {
                        modalities: ["text", "audio"]
                    }
                };
                console.log("Invio greeting iniziale");
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
        
        const sdpResponse = await fetch(`${REALTIME_API_URL}?model=${currentModel}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ephemeralKey}`,
                "Content-Type": "application/sdp",
            },
            body: pc.localDescription.sdp,
        });
        
        if (!sdpResponse.ok) {
            throw new Error(`Errore SDP: ${sdpResponse.status}`);
        }
        
        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };
        
        await pc.setRemoteDescription(answer);
        console.log("Connessione WebRTC stabilita");
        
    } catch (error) {
        console.error("Errore conversazione:", error);
        statusDiv.textContent = "Errore: " + error.message;
        talkButton.disabled = false;
        endButton.disabled = true;
        isActive = false;
    }
}

// Handle server events
function handleServerEvent(event) {
    console.log("Evento ricevuto:", event.type);
    
    switch (event.type) {
        case "error":
            console.error("Errore server:", event.error);
            statusDiv.textContent = "Errore: " + event.error?.message || "Errore sconosciuto";
            break;
            
        case "session.created":
            console.log("Sessione creata");
            break;
            
        case "session.updated":
            console.log("Sessione aggiornata");
            break;
            
        case "response.audio.delta":
            // Audio in arrivo, attiva animazione
            if (!isResponseActive) {
                isResponseActive = true;
                faceAnimation.startSpeaking();
            }
            lastActivityTime = Date.now();
            break;
            
        case "response.audio.done":
            console.log("Audio completato");
            isResponseActive = false;
            faceAnimation.stopSpeaking();
            break;
            
        case "response.done":
            console.log("Risposta completata");
            isResponseActive = false;
            faceAnimation.stopSpeaking();
            lastActivityTime = Date.now();
            break;
            
        case "conversation.item.created":
            if (event.item?.content?.length > 0) {
                const content = event.item.content[0];
                if (content.type === "input_text") {
                    addToConversation(currentUser.full_name, content.text);
                } else if (content.type === "text" && event.item.role === "assistant") {
                    addToConversation(currentAI.name, content.text);
                }
            }
            break;
            
        case "conversation.item.truncated":
            console.log("Item troncato");
            break;
            
        case "conversation.item.deleted":
            console.log("Item eliminato");
            break;
            
        case "conversation.item.input_audio_transcription.completed":
            if (event.transcript) {
                console.log("Trascrizione user:", event.transcript);
                addToConversation(currentUser.full_name, event.transcript);
            }
            break;
            
        case "response.output_item.added":
            if (event.item?.content?.length > 0) {
                const content = event.item.content[0];
                if (content.type === "text") {
                    console.log(`${currentAI.name} dice:`, content.text);
                }
            }
            break;
            
        case "response.function_call_arguments.done":
            console.log("Chiamata funzione completata:", event);
            if (event.name === "cerca_nella_mia_memoria_personale") {
                handleMemorySearch(event);
            }
            break;
            
        case "input_audio_buffer.speech_started":
            console.log("Inizio parlato rilevato");
            lastActivityTime = Date.now();
            break;
            
        case "input_audio_buffer.speech_stopped":
            console.log("Fine parlato rilevato");
            break;
            
        case "input_audio_buffer.committed":
            console.log("Audio committato");
            break;
            
        case "input_audio_buffer.cleared":
            console.log("Buffer audio pulito");
            break;
    }
}

// Handle memory search
async function handleMemorySearch(event) {
    try {
        const args = JSON.parse(event.arguments);
        console.log("Ricerca memoria per:", args.termini_di_ricerca);
        
        const response = await fetch(SEARCH_MEMORY_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                searchTerms: args.termini_di_ricerca,
                userId: currentUser.id,
                aiCharacter: currentAI.name.toLowerCase()
            })
        });
        
        if (!response.ok) throw new Error('Errore ricerca memoria');
        
        const data = await response.json();
        console.log("Risultati ricerca:", data.results?.length || 0);
        
        // Invia i risultati alla conversazione
        if (dc && dc.readyState === 'open') {
            const functionOutput = {
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: event.call_id,
                    output: JSON.stringify(data.results || [])
                }
            };
            dc.send(JSON.stringify(functionOutput));
        }
    } catch (error) {
        console.error("Errore ricerca memoria:", error);
    }
}

// Add to conversation
function addToConversation(speaker, content) {
    if (!content || content.trim() === '') return;
    
    currentConversation.push({
        speaker: speaker,
        content: content,
        timestamp: new Date().toISOString()
    });
    
    console.log(`[${speaker}]: ${content}`);
}

// End conversation
async function endConversation() {
    console.log("Chiusura conversazione...");
    
    talkButton.disabled = false;
    endButton.disabled = true;
    isActive = false;
    
    // Stop animations
    faceAnimation.stopSpeaking();
    
    // Calculate duration
    const duration = conversationStartTime ? Math.floor((Date.now() - conversationStartTime) / 1000) : 0;
    
    // Update user time
    if (currentUser && duration > 0) {
        await updateUserTime(duration);
    }
    
    // Stop silence timer
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }
    
    // Clean up WebRTC
    if (dc) {
        dc.close();
        dc = null;
    }
    
    if (pc) {
        pc.close();
        pc = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clean up audio
    if (aiAudioPlayer.srcObject) {
        aiAudioPlayer.srcObject = null;
    }
    
    statusDiv.textContent = "Conversazione terminata";
    
    // Save conversation summary if there's content
    if (currentConversation.length > 2) {
        console.log("Salvataggio riassunto conversazione...");
        try {
            // Extract important info
            const extractResponse = await fetch(EXTRACT_INFO_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    conversation: currentConversation,
                    userId: currentUser.id
                })
            });
            
            if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                if (extractData.importantInfo?.length > 0) {
                    await fetch(SAVE_IMPORTANT_INFO_API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            importantInfo: extractData.importantInfo,
                            userId: currentUser.id
                        })
                    });
                }
            }
            
            // Save conversation summary
            const summaryResponse = await fetch(SAVE_SUMMARY_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    conversation: currentConversation,
                    userId: currentUser.id,
                    aiCharacter: currentAI.name.toLowerCase()
                })
            });
            
            if (summaryResponse.ok) {
                console.log("Riassunto salvato con successo");
            }
        } catch (error) {
            console.error("Errore salvataggio conversazione:", error);
        }
    }
    
    currentConversation = [];
}

// Update user time
async function updateUserTime(durationSeconds) {
    try {
        const response = await fetch(UPDATE_TIME_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                durationSeconds,
                model: currentModel
            })
        });
        
        if (!response.ok) throw new Error('Errore aggiornamento tempo');
        
        const data = await response.json();
        userTimeInfo = data.timeInfo;
        
    } catch (error) {
        console.error('Errore aggiornamento tempo:', error);
    }
}

// Silence monitor
function startSilenceMonitor() {
    const checkSilence = () => {
        const now = Date.now();
        const silenceDuration = now - lastActivityTime;
        
        // Se sono passati più di 3 minuti di silenzio
        if (silenceDuration > 180000 && isActive && !isResponseActive) {
            console.log("Rilevato silenzio prolungato, invio prompt...");
            
            if (dc && dc.readyState === 'open') {
                const prompt = {
                    type: "response.create",
                    response: {
                        modalities: ["text", "audio"],
                        instructions: "L'utente è silenzioso da un po'. Chiedi se c'è ancora o se ha bisogno di qualcosa, in modo naturale e con la tua personalità."
                    }
                };
                dc.send(JSON.stringify(prompt));
                lastActivityTime = Date.now(); // Reset timer
            }
        }
        
        // Continua a monitorare
        if (isActive) {
            silenceTimer = setTimeout(checkSilence, 30000); // Check ogni 30 secondi
        }
    };
    
    silenceTimer = setTimeout(checkSilence, 30000);
}

// Event listeners
talkButton.addEventListener('click', startConversation);
endButton.addEventListener('click', endConversation);

// Status helper
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status-minimal status-${type}`;
}

// Add popup styles
const style = document.createElement('style');
style.textContent = `
.time-expired-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
}

.popup-content {
    background: var(--card-bg);
    padding: 3rem;
    border-radius: 20px;
    border: 2px solid var(--accent-color);
    text-align: center;
    max-width: 400px;
}

.popup-content h2 {
    color: var(--accent-color);
    margin-bottom: 1rem;
}

.popup-content p {
    margin-bottom: 1rem;
    color: var(--text-dim);
}

.popup-content button {
    padding: 1rem 2rem;
    background: var(--accent-color);
    border: none;
    border-radius: 10px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.popup-content button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 20px rgba(255, 0, 110, 0.4);
}

.status-error {
    color: var(--accent-color) !important;
}
`;
document.head.appendChild(style); 