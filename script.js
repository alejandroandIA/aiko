// CI SONO IO - Script principale con sezioni tematiche e personaggi espansi
// MODALITÀ OFFLINE - Non usa database Supabase
// La IA riceve il nome utente ma non salva conversazioni

// Import delle configurazioni
import { AI_SECTIONS, AI_CHARACTERS } from './src/config/ai-characters.js';
import { CHARACTER_INSTRUCTIONS, getFullInstructions } from './src/config/character-instructions.js';

// Elementi DOM
const loginForm = document.getElementById('loginForm');
const loginContainer = document.getElementById('loginContainer');
const exploreContainer = document.getElementById('exploreContainer');
const sectionsGrid = document.getElementById('sectionsGrid');
const charactersContainer = document.getElementById('charactersContainer');
const charactersGrid = document.getElementById('charactersGrid');
const sectionTitle = document.getElementById('sectionTitle');
const conversationScreen = document.getElementById('conversationScreen');
const userDisplay = document.getElementById('userDisplay');
const characterNameDisplay = document.getElementById('characterNameDisplay');
const characterRoleDisplay = document.getElementById('characterRoleDisplay');
const characterNameStage = document.getElementById('characterNameStage');
const characterAvatarLarge = document.getElementById('characterAvatarLarge');
const characterAura = document.getElementById('characterAura');
const voiceWaves = document.getElementById('voiceWaves');
const timerElement = document.getElementById('timer');
const timerCircle = document.getElementById('timerCircle');

// Sezioni navigazione
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');
const mainHeader = document.getElementById('mainHeader');

// Controlli conversazione
const talkButton = document.getElementById('talkButton');
const endButton = document.getElementById('endButton');
const recordingIndicator = document.getElementById('recordingIndicator');
const thinkingIndicator = document.getElementById('thinkingIndicator');
const statusDiv = document.getElementById('status');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

// API Configuration
const PREMIUM_MODEL = "gpt-4o-realtime-preview-2024-12-17";
const STANDARD_MODEL = "gpt-4o-mini-realtime-preview-2024-12-17";
const REALTIME_API_URL = "https://api.openai.com/v1/realtime";

// API Endpoints
const SESSION_API_ENDPOINT = "/api/session"; // Ancora necessario per OpenAI
// MODALITÀ OFFLINE - API database non necessarie
// const LOGIN_API_ENDPOINT = "/api/login";
// const CHECK_TIME_API_ENDPOINT = "/api/checkUserTime";
// const UPDATE_TIME_API_ENDPOINT = "/api/updateUserTime";
// const SAVE_SUMMARY_API_ENDPOINT = "/api/saveConversationSummary";
// const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
// const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
// const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
// const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";

// State
let currentUser = null;
let currentCharacter = null;
let currentSection = null;
let userTimeInfo = null;
let timerInterval = null;
let sessionTimer = null;
let currentModel = PREMIUM_MODEL;
let conversationStartTime = null;
let totalSecondsUsed = 0;
let isTimerRunning = false;

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

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    initializeAnimations();
});

function initializeApp() {
    // Setup navigazione
    setupNavigation();
    
    // Carica le sezioni
    loadSections();
    
    // Setup event listeners
    setupEventListeners();
}

// Navigazione
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            
            if (targetId === 'esplora' && !currentUser) {
                showStatus('Devi effettuare il login prima', 'error');
                return;
            }
            
            showSection(targetId);
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'flex';
    }
}

// Carica le sezioni tematiche
function loadSections() {
    sectionsGrid.innerHTML = '';
    
    Object.entries(AI_SECTIONS).forEach(([sectionId, section]) => {
        const sectionCard = createSectionCard(sectionId, section);
        sectionsGrid.appendChild(sectionCard);
    });
}

function createSectionCard(sectionId, section) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.onclick = () => showCharacters(sectionId, section);
    
    card.innerHTML = `
        <div class="section-icon">${section.icon}</div>
        <h3 class="section-name">${section.title}</h3>
        <p class="section-description">${section.description}</p>
        <div class="section-count">${section.characters.length} personaggi disponibili</div>
    `;
    
    return card;
}

// Mostra i personaggi di una sezione
function showCharacters(sectionId, section) {
    currentSection = sectionId;
    sectionTitle.textContent = section.title;
    
    charactersGrid.innerHTML = '';
    
    section.characters.forEach(characterId => {
        const character = AI_CHARACTERS[characterId];
        if (character) {
            const characterCard = createCharacterCard(characterId, character);
            charactersGrid.appendChild(characterCard);
        }
    });
    
    sectionsGrid.style.display = 'none';
    charactersContainer.style.display = 'block';
}

function createCharacterCard(characterId, character) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.style.borderColor = character.color + '40';
    
    card.innerHTML = `
        <div class="character-avatar" style="color: ${character.color}">${character.avatar}</div>
        <h4 class="character-name">${character.name}</h4>
        <div class="character-age">${character.age} anni</div>
        <p class="character-description">${character.shortDesc}</p>
        <button class="btn-select-character" style="background: linear-gradient(45deg, ${character.color}, var(--secondary-color))" onclick="selectCharacter('${characterId}')">
            Parla con ${character.name.split(' ')[0]}
        </button>
    `;
    
    return card;
}

// Torna alle sezioni
window.backToSections = function() {
    charactersContainer.style.display = 'none';
    sectionsGrid.style.display = 'grid';
    currentSection = null;
};

// Setup Event Listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Talk button
    talkButton.addEventListener('click', () => {
        if (!isActive) {
            startConversation();
        }
    });
    
    // End button
    endButton.addEventListener('click', () => {
        if (isActive) {
            endConversation();
        }
    });
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const nome = document.getElementById('userName').value.trim();
    const cognome = document.getElementById('userSurname').value.trim();
    
    if (!nome || !cognome) {
        showStatus('Per favore inserisci nome e cognome', 'error');
        return;
    }
    
    // MODALITÀ OFFLINE - Non usa database
    currentUser = {
        id: 'offline-user',
        nome: nome,
        cognome: cognome,
        full_name: `${nome} ${cognome}`
    };
    
    // Timer fisso di 20 minuti per modalità offline
    userTimeInfo = {
        premium_minutes_remaining: 10,
        standard_minutes_remaining: 10,
        can_use_premium: true,
        can_use_standard: true
    };
    
    // Mostra nome utente
    userDisplay.textContent = `Ciao ${currentUser.full_name}!`;
    
    // Vai alla sezione esplora
    showSection('esplora');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[href="#esplora"]').classList.add('active');
    
    showStatus('Benvenuto! Modalità offline attiva.', 'success');
}

// Logout
window.logout = function() {
    currentUser = null;
    currentCharacter = null;
    currentSection = null;
    userTimeInfo = null;
    
    // Reset form
    document.getElementById('userName').value = '';
    document.getElementById('userSurname').value = '';
    
    // Torna al login
    showSection('home');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[href="#home"]').classList.add('active');
};

// Selezione personaggio
window.selectCharacter = async function(characterId) {
    if (!currentUser) {
        showStatus('Devi effettuare il login prima', 'error');
        return;
    }
    
    currentCharacter = AI_CHARACTERS[characterId];
    if (!currentCharacter) {
        console.error('Personaggio non trovato:', characterId);
        showStatus('Errore: personaggio non trovato', 'error');
        return;
    }
    
    // MODALITÀ OFFLINE - Usa sempre premium model
    currentModel = PREMIUM_MODEL;
    
    // Aggiorna UI conversazione
    characterNameDisplay.textContent = currentCharacter.name;
    characterRoleDisplay.textContent = currentCharacter.fullDesc;
    characterNameStage.textContent = currentCharacter.name.toUpperCase();
    characterAvatarLarge.textContent = currentCharacter.avatar;
    characterAvatarLarge.style.fontSize = '150px';
    
    // Imposta colore tema
    updateCharacterTheme(currentCharacter.color);
    
    // Nascondi tutto e mostra schermata conversazione
    sections.forEach(s => s.style.display = 'none');
    mainHeader.style.display = 'none';
    conversationScreen.style.display = 'flex';
    
    // Mostra 20 minuti disponibili
    updateTimerDisplay(20 * 60);
};

// Aggiorna tema colore per il personaggio
function updateCharacterTheme(color) {
    document.documentElement.style.setProperty('--character-color', color);
    characterAura.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
    
    // Aggiorna colori waves
    const waves = document.querySelectorAll('.wave');
    waves.forEach(wave => {
        wave.style.background = color;
    });
}

// Torna alla selezione
window.backToSelection = function() {
    if (isActive) {
        endConversation();
    }
    
    stopTimer();
    conversationScreen.style.display = 'none';
    mainHeader.style.display = 'block';
    showSection('esplora');
    
    // Ripristina colori default
    document.documentElement.style.setProperty('--character-color', 'var(--primary-color)');
};

// Check user time
async function checkUserTime() {
    // MODALITÀ OFFLINE - Sempre 20 minuti disponibili
    return {
        canChat: true,
        model: PREMIUM_MODEL,
        remainingMinutes: 20
    };
}

// Timer management
function startTimer() {
    if (isTimerRunning) return;
    
    isTimerRunning = true;
    let totalSeconds = 20 * 60; // MODALITÀ OFFLINE - Sempre 20 minuti
    totalSecondsUsed = 0;
    
    updateTimerDisplay(totalSeconds);
    
    timerInterval = setInterval(() => {
        totalSeconds--;
        totalSecondsUsed++;
        
        if (totalSeconds <= 0) {
            stopTimer();
            endConversation();
            showStatus('Tempo scaduto! La conversazione è terminata.', 'info');
            return;
        }
        
        // Cambia modello dopo 10 minuti (opzionale in modalità offline)
        if (totalSecondsUsed === 600 && currentModel === PREMIUM_MODEL) {
            // In modalità offline manteniamo sempre premium
            // switchToStandardModel();
        }
        
        updateTimerDisplay(totalSeconds);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        isTimerRunning = false;
    }
}

function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    
    // Aggiorna cerchio timer
    const totalTime = 20 * 60; // 20 minuti totali
    const percentage = (totalTime - (totalTime - seconds)) / totalTime;
    const circumference = 283; // 2 * PI * r dove r = 45
    const offset = circumference - (percentage * circumference);
    timerCircle.style.strokeDashoffset = offset;
    
    // Cambia colore quando il tempo sta per finire
    if (seconds <= 60) {
        timerCircle.style.stroke = 'var(--secondary-color)';
        timerElement.style.color = 'var(--secondary-color)';
    } else if (seconds <= 300) {
        timerCircle.style.stroke = 'var(--accent-color)';
        timerElement.style.color = 'var(--accent-color)';
    }
}

// Ottieni il contesto iniziale con memoria e istruzioni personaggio
async function getInitialContext() {
    // MODALITÀ OFFLINE - Non cerca memoria nel database
    // Ottieni le istruzioni complete del personaggio con il nome utente
    const characterInstructions = getFullInstructions(currentCharacter.id, currentUser.full_name);
    
    return {
        summary: '', // Nessun riassunto in modalità offline
        instructions: characterInstructions || CHARACTER_INSTRUCTIONS[currentCharacter.id] || ''
    };
}

// Avvia conversazione
async function startConversation() {
    if (isActive) return;
    
    try {
        talkButton.disabled = true;
        talkButton.classList.add('active');
        recordingIndicator.classList.add('active');
        showStatus('Connessione in corso...', 'info');
        
        // Ottieni contesto e istruzioni
        const context = await getInitialContext();
        
        // Ottieni token sessione
        const sessionResponse = await fetch(SESSION_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                voice: currentCharacter.voice,
                instructions: context.instructions,
                contextSummary: context.summary,
                temperature: 0.8,
                max_tokens: 4096
            })
        });
        
        if (!sessionResponse.ok) throw new Error('Errore creazione sessione');
        
        const data = await sessionResponse.json();
        ephemeralKey = data.session_key;
        
        // Inizia il timer solo ora
        conversationStartTime = new Date();
        sessionStartTime = Date.now();
        startTimer();
        
        // Setup WebRTC
        await setupWebRTC();
        
    } catch (error) {
        console.error('Errore avvio conversazione:', error);
        showStatus('Errore nella connessione. Riprova.', 'error');
        talkButton.disabled = false;
        talkButton.classList.remove('active');
        recordingIndicator.classList.remove('active');
    }
}

// Setup WebRTC connection
async function setupWebRTC() {
    try {
        // Ottieni stream audio
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Crea peer connection
        pc = new RTCPeerConnection();
        
        // Aggiungi audio tracks
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        
        // Setup data channel
        dc = pc.createDataChannel('data', { ordered: true });
        
        dc.onopen = () => {
            console.log('DataChannel aperto');
            isActive = true;
            endButton.disabled = false;
            showStatus('Connesso! Puoi iniziare a parlare.', 'success');
            
            // Invia configurazione sessione
            const sessionConfig = {
                type: "session.update",
                session: {
                    modalities: ["text", "audio"],
                    voice: currentCharacter.voice,
                    input_audio_format: "pcm16",
                    output_audio_format: "pcm16",
                    input_audio_transcription: {
                        enabled: true,
                        language: "it",
                        model: "whisper-1"
                    },
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.7,
                        silence_duration_ms: 500
                    }
                }
            };
            dc.send(JSON.stringify(sessionConfig));
            
            startSilenceMonitor();
        };
        
        dc.onmessage = handleServerEvent;
        dc.onclose = () => handleDisconnection();
        dc.onerror = (error) => console.error('DataChannel error:', error);
        
        // Crea e invia offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        // Invia offer al server
        const baseUrl = 'https://api.openai.com/v1/realtime';
        const model = currentModel;
        const sdpResponse = await fetch(`${baseUrl}?model=${model}&session_key=${ephemeralKey}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ephemeralKey}`,
                'Content-Type': 'application/sdp'
            },
            body: offer.sdp
        });
        
        if (!sdpResponse.ok) throw new Error('Errore SDP');
        
        const answer = {
            type: 'answer',
            sdp: await sdpResponse.text()
        };
        
        await pc.setRemoteDescription(answer);
        
    } catch (error) {
        console.error('Errore WebRTC setup:', error);
        showStatus('Errore nella configurazione audio. Verifica i permessi del microfono.', 'error');
        endConversation();
    }
}

// Gestione eventi dal server
function handleServerEvent(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('Server event:', data.type);
        
        switch (data.type) {
            case 'response.audio.delta':
                if (data.delta) {
                    playAudioDelta(data.delta);
                }
                break;
                
            case 'response.audio.started':
                isResponseActive = true;
                voiceWaves.classList.add('active');
                thinkingIndicator.classList.remove('active');
                lastActivityTime = Date.now();
                break;
                
            case 'response.audio.done':
                isResponseActive = false;
                voiceWaves.classList.remove('active');
                break;
                
            case 'input_audio_transcription.completed':
                if (data.transcript) {
                    addToConversation('user', data.transcript);
                    thinkingIndicator.classList.add('active');
                }
                break;
                
            case 'response.text.delta':
                if (data.delta) {
                    // Potremmo mostrare il testo se volessimo
                }
                break;
                
            case 'response.text.done':
                if (data.text) {
                    addToConversation(currentCharacter.name, data.text);
                }
                break;
                
            case 'conversation.item.created':
                if (data.item && data.item.type === 'function_call' && 
                    data.item.function_name === 'search_memory') {
                    handleMemorySearch(data.item);
                }
                break;
                
            case 'error':
                console.error('Server error:', data);
                showStatus('Errore dal server: ' + (data.message || 'Errore sconosciuto'), 'error');
                break;
        }
        
    } catch (error) {
        console.error('Errore gestione evento:', error);
    }
}

// Play audio delta
function playAudioDelta(base64Audio) {
    try {
        const audioData = atob(base64Audio);
        const audioArray = new Uint8Array(audioData.length);
        
        for (let i = 0; i < audioData.length; i++) {
            audioArray[i] = audioData.charCodeAt(i);
        }
        
        const blob = new Blob([audioArray], { type: 'audio/pcm' });
        const audioUrl = URL.createObjectURL(blob);
        
        aiAudioPlayer.src = audioUrl;
        aiAudioPlayer.play().catch(e => console.error('Errore riproduzione audio:', e));
        
    } catch (error) {
        console.error('Errore decodifica audio:', error);
    }
}

// Aggiungi alla conversazione
function addToConversation(speaker, content) {
    currentConversation.push({
        speaker: speaker,
        content: content,
        timestamp: new Date()
    });
    
    console.log(`${speaker}: ${content}`);
}

// Termina conversazione
async function endConversation() {
    if (!isActive) return;
    
    try {
        isActive = false;
        stopTimer();
        
        // Chiudi connessioni
        if (dc && dc.readyState === 'open') {
            dc.close();
        }
        if (pc) {
            pc.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Reset UI
        talkButton.disabled = false;
        talkButton.classList.remove('active');
        endButton.disabled = true;
        recordingIndicator.classList.remove('active');
        thinkingIndicator.classList.remove('active');
        voiceWaves.classList.remove('active');
        
        // MODALITÀ OFFLINE - Non salva conversazioni
        showStatus('Conversazione terminata', 'success');
        
        // Reset conversazione corrente
        currentConversation = [];
        
    } catch (error) {
        console.error('Errore terminazione conversazione:', error);
    }
}

// Monitor silenzio
function startSilenceMonitor() {
    const checkSilence = () => {
        if (!isActive) return;
        
        const now = Date.now();
        const silenceDuration = now - lastActivityTime;
        
        if (silenceDuration > 120000 && !isResponseActive) { // 2 minuti
            console.log('Rilevato silenzio prolungato, invio messaggio di check');
            
            const checkMessage = {
                type: "conversation.item.create",
                item: {
                    type: "message",
                    role: "user",
                    content: [{
                        type: "input_text",
                        text: "Sei ancora lì?"
                    }]
                }
            };
            
            if (dc && dc.readyState === 'open') {
                dc.send(JSON.stringify(checkMessage));
                lastActivityTime = now;
            }
        }
        
        if (isActive) {
            silenceTimer = setTimeout(checkSilence, 30000); // Check ogni 30 secondi
        }
    };
    
    checkSilence();
}

// Gestione disconnessione
function handleDisconnection() {
    console.log('Disconnesso dal server');
    if (isActive) {
        showStatus('Connessione persa. La conversazione è stata terminata.', 'error');
        endConversation();
    }
}

// Mostra status
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status-modern show ${type}`;
    
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 5000);
}

// Inizializza animazioni
function initializeAnimations() {
    // Matrix animation
    initMatrixAnimation();
    
    // Particle animation
    initParticleAnimation();
}

// Matrix animation
function initMatrixAnimation() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const matrixContainer = document.getElementById('matrixCanvas');
    
    if (!matrixContainer) return;
    
    matrixContainer.appendChild(canvas);
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const matrix = "CISONOIO01アイコ愛子";
    const matrixArray = matrix.split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = [];
    
    for (let x = 0; x < columns; x++) {
        drops[x] = Math.random() * -100;
    }
    
    function drawMatrix() {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.04)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#00ff41';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const text = matrixArray[Math.floor(Math.random() * matrixArray.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    
    setInterval(drawMatrix, 35);
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Particle animation
function initParticleAnimation() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const particleContainer = document.getElementById('particleCanvas');
    
    if (!particleContainer) return;
    
    particleContainer.appendChild(canvas);
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 50;
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = '#00ff41';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        
        requestAnimationFrame(animateParticles);
    }
    
    animateParticles();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
} 