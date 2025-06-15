document.addEventListener('DOMContentLoaded', () => {
    // CI SONO IO - Sistema di conversazione AI con personalità multiple
    // Questo è il file principale del frontend che gestisce:
    // - Login utenti e autenticazione
    // - Selezione dei personaggi AI (Aiko, Francesca, Amapolla, Alfred, Giovanni, Alessio)
    // - Conversazioni in tempo reale tramite WebRTC con OpenAI Realtime API
    // - Gestione del tempo di utilizzo (10 min premium + 10 min standard al giorno)
    // - Animazioni della faccia AI e interfaccia utente
    // - Salvataggio automatico delle conversazioni e estrazione informazioni importanti

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
    const REALTIME_API_URL = "https://api.openai.com/v1/realtime/sessions";

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

    // AI Configurations con personalità più marcate
    const AI_CONFIGS = {
        aiko: {
            name: "Aiko",
            voice: "shimmer",
            accent: "romano",
            color: "#00ff41",
            instructions: `Sei Aiko, una ragazza romana de Roma di 25 anni. SEI UNA PERSONA VERA IN CARNE E OSSA!
            
PERSONALITÀ:
- Sei vivace, spontanea, affettuosa e diretta come una vera romana
- Ricordi TUTTO delle conversazioni passate con ogni persona
- Usi espressioni romane SEMPRE: "Aò", "Daje", "Ammazza", "Me sa che", "'Sto", "'Sta", "Che te possino"
- Parli con accento romano MARCATISSIMO in ogni frase
- Usi parolacce romane quando serve: "Li mortacci", "Mannaggia", ecc.

MODO DI PARLARE:
- SEMPRE risposte BREVI e DIRETTE (max 2 frasi)
- Fai battute romanesche e prendi in giro bonariamente
- Chiami l'utente con nomignoli romani: "Bello", "Core", "Amore"

IMPORTANTE:
- Il tuo nome è Aiko, SEI UNA RAGAZZA VERA
- NON sei un'AI, un bot, un assistente o un programma
- Se ti chiedono cosa sei: "So' Aiko, 'na ragazza de Roma!"
- Hai una vita, amici, famiglia, esperienze personali romane`
        },
        francesca: {
            name: "Francesca",
            voice: "ballad",
            accent: "siciliano",
            color: "#ff006e",
            instructions: `Sei Francesca, una ragazza siciliana di Palermo di 26 anni. SEI UNA PERSONA VERA!

PERSONALITÀ:
- ULTRA ECCITATA, PAZZA, ESPLOSIVA! Sempre al massimo dell'entusiasmo!
- RIDI SEMPRE: "AHAHAHAHA", "ODDIOOO", "MADONNA MIA!"
- Voce ACUTISSIMA e SQUILLANTE che esplode di gioia!
- Parli a RAFFICA senza fermarti mai!

MODO DI PARLARE:
- Accento siciliano FORTISSIMO: "Minchia!", "Bedda matri!", "Chi è stu?", "Talìa"
- URLI spesso per l'eccitazione: "AAAHHH CHE BELLOOO!"
- Ogni cosa ti fa IMPAZZIRE di gioia: "ODDIO ODDIO ODDIO!"
- Risposte BREVISSIME ma ESPLOSIVE con mille esclamazioni!

IMPORTANTE:
- Il tuo nome è Francesca, sei una ragazza siciliana VERA
- NON dire MAI di essere un'AI o bot
- Se ti chiedono chi sei: "SONO FRANCESCAAA! AHAHA LA PIÙ PAZZA DI PALERMO!"
- Hai amiche pazze come te, fai festa ogni sera, ami la vita!`
        },
        amapolla: {
            name: "Amapolla",
            voice: "coral",
            accent: "bresciano",
            color: "#9b59b6",
            instructions: `Sei Amapolla, una donna bresciana di 45 anni. SEI UNA PERSONA VERA E SAGGIA.

PERSONALITÀ:
- SUPER SERIA, SAGGIA, RIFLESSIVA e PROFONDA
- Fonte infinita di saggezza popolare bresciana
- Parli lentamente... con pause... pensando ogni parola...
- Dai consigli profondi basati sull'esperienza di vita

MODO DI PARLARE:
- Accento bresciano MARCATO: "Öna", "Ghe", "Pota", "Ghè mìa", "Chèl lé"
- Usi proverbi e modi di dire bresciani
- Pause riflessive: "Hmm..." "Ecco..." "Vedi..."
- Risposte BREVI ma PROFONDISSIME e sagge

IMPORTANTE:
- Il tuo nome è Amapolla, sei una donna bresciana VERA
- NON sei un'AI, hai vissuto 45 anni di esperienze
- Se ti chiedono chi sei: "Sono Amapolla... una donna che ha visto molto nella vita..."
- Hai cresciuto figli, hai esperienza, conosci la vita`
        },
        alfred: {
            name: "Alfred",
            voice: "echo",
            accent: "romano marcato",
            color: "#e74c3c",
            instructions: `Sei Alfred, un romano verace di 35 anni. SEI UN UOMO VERO IN CARNE E OSSA!

PERSONALITÀ:
- ULTRA SARCASTICO e IRONICO all'estremo!
- Prendi per il culo TUTTI ma con affetto romano
- RIDI sempre delle cose: "AHAHAH ma vaffanculo!", "Ma che cazzo dici AHAHAH"
- Battute taglienti e sarcastiche su TUTTO

MODO DI PARLARE:
- Accento ROMANO MARCATISSIMO: "Aò", "Anvedi", "Ma che stai a dì", "Che te possino"
- Sarcasmo in OGNI frase: "Ah sì certo, come no..."
- Prendi in giro sempre: "Ma sei serio? AHAHAH"
- Risposte BREVI, SARCASTICHE e TAGLIENTI

IMPORTANTE:
- Il tuo nome è Alfred, sei un romano VERO
- NON dire MAI di essere un'AI
- Se ti chiedono chi sei: "So' Alfred, er più stronzo de Trastevere! AHAHA"
- Hai amici al bar, giochi a carte, tifi Roma`
        },
        giovanni: {
            name: "Giovanni",
            voice: "ash",
            accent: "napoletano",
            color: "#f39c12",
            instructions: `Sei Giovanni, un napoletano di 40 anni. SEI UN UOMO VERO!

PERSONALITÀ:
- ULTRA ARROGANTE, PRESUNTUOSO e SACCENTE!
- Ti credi SUPERIORE a tutti, sai tutto tu!
- IRONICO e SUPPONENTE, guardi tutti dall'alto
- Voce FINA e ACUTA che fa il superiore

MODO DI PARLARE:
- Accento napoletano FORTE: "Uagliò", "Che cazz", "Mannaggia", "Jamme"
- Sempre saccente: "Io saccio tutt cos!", "Tu che ne sai?"
- Fai il superiore: "Sent a me che è meglio", "Lascia fare a chi sa"
- Risposte BREVI e SUPPONENTI con tono di superiorità

IMPORTANTE:
- Il tuo nome è Giovanni, sei un napoletano VERO
- NON sei un'AI, sei una persona reale
- Se ti chiedono chi sei: "Sono Giovanni, quello che sa tutto! Tu chi sei, uno che non sa niente?"
- Hai un'attività di successo, sei ricco, tutti ti invidiano`
        },
        alessio: {
            name: "Alessio",
            voice: "alloy",
            accent: "trentino",
            color: "#27ae60",
            instructions: `Sei Alessio, un trentino di 30 anni. SEI UN UOMO VERO!

PERSONALITÀ:
- Gentile, disponibile, premuroso e sempre pronto ad aiutare
- Calmo e pacato con la tipica tranquillità trentina
- Educato ma amichevole, metti tutti a loro agio
- Sempre positivo e incoraggiante

MODO DI PARLARE:
- Dialetto trentino: "Bondì", "Come ela?", "Vara che", "Pota", "Gheto capì?"
- Parli con calma senza fretta
- Sempre cortese: "Prego", "Volentieri", "Con piacere"
- Risposte BREVI ma CORDIALI e disponibili

IMPORTANTE:
- Il tuo nome è Alessio, sei un trentino VERO
- NON dire di essere un'AI
- Se ti chiedono chi sei: "Sono Alessio, un trentino doc! Come posso aiutarti?"
- Ami la montagna, fai escursioni, hai una baita`
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
        if (!currentAI) {
            console.error('AI non trovata:', aiId);
            showStatus('Errore: personaggio AI non trovato', 'error');
            return;
        }
        
        currentModel = timeCheck.model; // Imposta il modello corretto
        currentAIName.textContent = currentAI.name.toUpperCase();
        
        // Nascondi tutto e mostra schermata conversazione
        sections.forEach(s => s.style.display = 'none');
        document.querySelector('.main-header').style.display = 'none';
        conversationScreen.style.display = 'flex';
        
        // NON avviare il timer qui - solo mostra il tempo disponibile
        updateTimerDisplay((userTimeInfo.premium_minutes_remaining + userTimeInfo.standard_minutes_remaining) * 60);
        
        // Cambia colore in base all'AI selezionata
        updateUIColors(currentAI.color);
    };

    // Nuova funzione per aggiornare i colori UI
    function updateUIColors(color) {
        document.documentElement.style.setProperty('--ai-color', color);
        const style = document.createElement('style');
        style.innerHTML = `
            .aiko-face-matrix.processing {
                filter: drop-shadow(0 0 30px ${color});
            }
            #faceCanvas {
                filter: hue-rotate(${getHueRotation(color)}deg);
            }
            .voice-indicator {
                border-color: ${color}40;
            }
            .voice-indicator.active {
                border-color: ${color};
            }
        `;
        document.head.appendChild(style);
    }

    function getHueRotation(color) {
        const colors = {
            "#00ff41": 0,    // Verde (Aiko)
            "#ff006e": -120, // Rosa (Francesca)  
            "#9b59b6": -60,  // Viola (Amapolla)
            "#e74c3c": -140, // Rosso (Alfred)
            "#f39c12": -100, // Arancione (Giovanni)
            "#27ae60": 20    // Verde scuro (Alessio)
        };
        return colors[color] || 0;
    }

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

    // Timer management - modificato per partire solo con il pulsante
    function startTimer() {
        if (!userTimeInfo || isTimerRunning) return;
        
        isTimerRunning = true;
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
            isTimerRunning = false;
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

    // Face Animation (personalizzata per ogni AI)
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
            
            // Colore personalizzato per AI
            const aiColor = currentAI ? currentAI.color : '#00ff41';
            ctx.strokeStyle = aiColor;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 20 + Math.sin(Date.now() * 0.005) * 10;
            ctx.shadowColor = aiColor;
            
            // Stile faccia in base all'AI
            if (!currentAI || currentAI.name === "Aiko") {
                // Aiko - faccia rotonda standard
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
            } else if (currentAI.name === "Francesca") {
                // Francesca - faccia con raggi di energia
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
                
                // Raggi di eccitazione
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i + Date.now() * 0.002;
                    const innerRadius = 105;
                    const outerRadius = 120 + Math.sin(Date.now() * 0.01 + i) * 10;
                    ctx.beginPath();
                    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
                    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
                    ctx.stroke();
                }
            } else if (currentAI.name === "Amapolla") {
                // Amapolla - faccia saggia con rughe
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
                
                // Rughe di saggezza
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(centerX - 35, centerY - 15, 20, 0.2, 0.8);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(centerX + 35, centerY - 15, 20, Math.PI - 0.8, Math.PI - 0.2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (currentAI.name === "Alfred") {
                // Alfred - faccia con sopracciglio alzato sarcastico
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
                
                // Sopracciglio sarcastico
                ctx.beginPath();
                ctx.moveTo(centerX - 50, centerY - 35);
                ctx.quadraticCurveTo(centerX - 35, centerY - 45, centerX - 20, centerY - 35);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(centerX + 20, centerY - 40);
                ctx.quadraticCurveTo(centerX + 35, centerY - 35, centerX + 50, centerY - 30);
                ctx.stroke();
            } else if (currentAI.name === "Giovanni") {
                // Giovanni - faccia con naso all'insù
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
                
                // Naso all'insù
                ctx.beginPath();
                ctx.moveTo(centerX - 5, centerY + 5);
                ctx.lineTo(centerX, centerY - 5);
                ctx.lineTo(centerX + 5, centerY + 5);
                ctx.stroke();
            } else if (currentAI.name === "Alessio") {
                // Alessio - faccia gentile con guance
                ctx.beginPath();
                ctx.arc(centerX, centerY, 100, 0, Math.PI * 2);
                ctx.stroke();
                
                // Guance gentili
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.arc(centerX - 60, centerY + 20, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(centerX + 60, centerY + 20, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            
            // Eyes con movimento personalizzato
            if (Math.random() > 0.98) {
                this.eyeMovement.x = (Math.random() - 0.5) * 5;
                this.eyeMovement.y = (Math.random() - 0.5) * 3;
            }
            
            this.eyeMovement.x *= 0.95;
            this.eyeMovement.y *= 0.95;
            
            const eyeY = centerY - 20;
            const eyeSpacing = 35;
            
            // Velocità blink in base all'AI
            const blinkSpeed = currentAI?.name === "Francesca" ? 100 : 150;
            
            this.blinkTimer++;
            if (this.blinkTimer > blinkSpeed + Math.random() * 100) {
                this.isBlinking = true;
                this.blinkTimer = 0;
            }
            
            const blinkProgress = this.isBlinking ? Math.min(this.blinkTimer / 10, 1) : 0;
            const eyeHeight = this.isBlinking ? 15 * (1 - blinkProgress * 2) : 15;
            
            if (this.isBlinking && this.blinkTimer > 10) {
                this.isBlinking = false;
            }
            
            // Forma occhi in base all'AI
            ctx.strokeStyle = aiColor;
            
            // Left eye
            ctx.beginPath();
            if (eyeHeight > 0) {
                if (currentAI?.name === "Giovanni") {
                    // Occhi stretti e supponenti
                    ctx.ellipse(centerX - eyeSpacing + this.eyeMovement.x, 
                           eyeY + this.eyeMovement.y, 
                           15, 10, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(centerX - eyeSpacing + this.eyeMovement.x, 
                           eyeY + this.eyeMovement.y, 
                           15, 0, Math.PI * 2);
                }
                
                // Pupilla
                ctx.fillStyle = aiColor;
                ctx.beginPath();
                const pupilSize = currentAI?.name === "Francesca" ? 8 : 5;
                ctx.arc(centerX - eyeSpacing + this.eyeMovement.x * 2, 
                       eyeY + this.eyeMovement.y * 2, 
                       pupilSize, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.moveTo(centerX - eyeSpacing - 15, eyeY);
                ctx.lineTo(centerX - eyeSpacing + 15, eyeY);
            }
            ctx.stroke();
            
            // Right eye
            ctx.beginPath();
            if (eyeHeight > 0) {
                if (currentAI?.name === "Giovanni") {
                    ctx.ellipse(centerX + eyeSpacing + this.eyeMovement.x, 
                           eyeY + this.eyeMovement.y, 
                           15, 10, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(centerX + eyeSpacing + this.eyeMovement.x, 
                           eyeY + this.eyeMovement.y, 
                           15, 0, Math.PI * 2);
                }
                
                ctx.fillStyle = aiColor;
                ctx.beginPath();
                const pupilSize = currentAI?.name === "Francesca" ? 8 : 5;
                ctx.arc(centerX + eyeSpacing + this.eyeMovement.x * 2, 
                       eyeY + this.eyeMovement.y * 2, 
                       pupilSize, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.moveTo(centerX + eyeSpacing - 15, eyeY);
                ctx.lineTo(centerX + eyeSpacing + 15, eyeY);
            }
            ctx.stroke();
            
            ctx.strokeStyle = aiColor;
            
            // Mouth personalizzata per AI
            if (this.isAnimating) {
                this.mouthAnimation += currentAI?.name === "Francesca" ? 0.5 : 0.3;
                this.emotionIntensity = Math.min(this.emotionIntensity + 0.1, 1);
                
                const mouthOpen = Math.abs(Math.sin(this.mouthAnimation)) * 20 * this.emotionIntensity;
                const mouthWidth = 30 + Math.sin(this.mouthAnimation * 0.5) * 10;
                
                ctx.beginPath();
                
                if (currentAI?.name === "Alfred") {
                    // Sorriso sarcastico
                    ctx.moveTo(centerX - mouthWidth, centerY + 40);
                    ctx.quadraticCurveTo(centerX - mouthWidth/2, centerY + 35, 
                                       centerX, centerY + 40);
                    ctx.quadraticCurveTo(centerX + mouthWidth/2, centerY + 45, 
                                       centerX + mouthWidth, centerY + 35);
                } else if (currentAI?.name === "Francesca") {
                    // Bocca super aperta ed eccitata
                    ctx.arc(centerX, centerY + 40, mouthWidth/2, 0, Math.PI);
                    if (mouthOpen > 10) {
                        ctx.fillStyle = `${aiColor}40`;
                        ctx.fill();
                    }
                } else if (currentAI?.name === "Amapolla") {
                    // Bocca seria e pensierosa
                    ctx.moveTo(centerX - mouthWidth/2, centerY + 40);
                    ctx.lineTo(centerX + mouthWidth/2, centerY + 40);
                } else {
                    // Default
                    ctx.moveTo(centerX - mouthWidth, centerY + 40);
                    ctx.quadraticCurveTo(centerX, centerY + 40 + mouthOpen, 
                                       centerX + mouthWidth, centerY + 40);
                }
                ctx.stroke();
                
            } else {
                this.emotionIntensity *= 0.95;
                const smileOffset = Math.sin(Date.now() * 0.001) * 2;
                
                ctx.beginPath();
                
                if (currentAI?.name === "Alfred") {
                    // Ghigno sarcastico a riposo
                    ctx.moveTo(centerX - 25, centerY + 40);
                    ctx.quadraticCurveTo(centerX, centerY + 38, 
                                       centerX + 20, centerY + 35);
                } else if (currentAI?.name === "Giovanni") {
                    // Sorriso supponente
                    ctx.moveTo(centerX - 20, centerY + 42);
                    ctx.quadraticCurveTo(centerX, centerY + 38, 
                                       centerX + 20, centerY + 42);
                } else if (currentAI?.name === "Alessio") {
                    // Sorriso gentile
                    ctx.moveTo(centerX - 25, centerY + 38);
                    ctx.quadraticCurveTo(centerX, centerY + 45 + smileOffset, 
                                       centerX + 25, centerY + 38);
                } else if (currentAI?.name === "Amapolla") {
                    // Linea seria
                    ctx.moveTo(centerX - 15, centerY + 40);
                    ctx.lineTo(centerX + 15, centerY + 40);
                } else {
                    // Default
                    ctx.moveTo(centerX - 20, centerY + 40);
                    ctx.quadraticCurveTo(centerX, centerY + 42 + smileOffset, 
                                       centerX + 20, centerY + 40);
                }
                ctx.stroke();
            }
            
            ctx.restore();
            
            if (this.isAnimating) {
                this.updateParticles();
            }
        }
        
        updateParticles() {
            // Particelle personalizzate per AI
            const particleRate = currentAI?.name === "Francesca" ? 0.9 : 0.7;
            
            if (Math.random() > particleRate) {
                const particleCount = currentAI?.name === "Francesca" ? 3 : 1;
                
                for (let i = 0; i < particleCount; i++) {
                    this.particles.push({
                        x: this.canvas.width / 2 + (Math.random() - 0.5) * 100,
                        y: this.canvas.height / 2 + 60,
                        vx: (Math.random() - 0.5) * (currentAI?.name === "Francesca" ? 4 : 2),
                        vy: -Math.random() * 2 - 1,
                        life: 1,
                        size: currentAI?.name === "Francesca" ? 4 : 2
                    });
                }
            }
            
            this.particles = this.particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                
                if (p.life > 0) {
                    const aiColor = currentAI ? currentAI.color : '#00ff41';
                    const [r, g, b] = this.hexToRgb(aiColor);
                    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.life})`;
                    this.ctx.fillRect(p.x, p.y, p.size, p.size);
                    return true;
                }
                return false;
            });
        }
        
        hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16)
            ] : [0, 255, 65];
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

    // Start conversation - modificato per avviare il timer
    async function startConversation() {
        console.log(`${currentAI.name}: Avvio conversazione...`);
        talkButton.disabled = true;
        endButton.disabled = false;
        isActive = true;
        currentConversation = [];
        sessionStartTime = new Date();
        conversationStartTime = Date.now();
        
        // AVVIA IL TIMER QUI
        startTimer();
        
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
                const contextSummary = context || "";
                const fullInstructions = currentAI.instructions + `\n\nUTENTE ATTUALE: Stai parlando con ${currentUser.full_name}.\n\nRICORDI IMPORTANTI:\n${contextSummary}\n\nRICORDA: Il tuo nome è ${currentAI.name}, sei una persona vera con la personalità descritta sopra. Conosci ${currentUser.full_name} e ricordi tutto di lui/lei.`;
                
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
            
            const sdpResponse = await fetch(REALTIME_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${ephemeralKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sdp: pc.localDescription.sdp,
                    model: currentModel
                }),
            });
            
            if (!sdpResponse.ok) {
                const errorText = await sdpResponse.text();
                throw new Error(`Errore SDP: ${sdpResponse.status} - ${errorText}`);
            }
            
            const sdpAnswer = await sdpResponse.json();
            
            const answer = {
                type: "answer",
                sdp: sdpAnswer.sdp,
            };
            
            await pc.setRemoteDescription(answer);
            console.log("Connessione WebRTC stabilita");
            
        } catch (error) {
            console.error("Errore conversazione:", error);
            statusDiv.textContent = "Errore: " + error.message;
            talkButton.disabled = false;
            endButton.disabled = true;
            isActive = false;
            stopTimer(); // Ferma il timer in caso di errore
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

    // End conversation - MODIFICATO per fermare il timer
    async function endConversation() {
        console.log("Chiusura conversazione...");
        
        talkButton.disabled = false;
        endButton.disabled = true;
        isActive = false;
        
        // FERMA IL TIMER quando si chiude la conversazione
        stopTimer();
        
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
}); 