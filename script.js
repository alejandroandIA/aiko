document.addEventListener('DOMContentLoaded', () => {
    // Elementi del DOM
    const loginForm = document.getElementById('loginForm');
    const loginContainer = document.getElementById('loginContainer');
    const aiSelectionContainer = document.getElementById('aiSelectionContainer');
    const conversationScreen = document.getElementById('conversationScreen');
    const userDisplay = document.getElementById('userDisplay');
    const timerElement = document.getElementById('timer');
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link');
    const talkButton = document.getElementById('talkButton');
    const endButton = document.getElementById('endButton');
    const statusDiv = document.getElementById('status');
    const aiAudioPlayer = document.getElementById('aiAudioPlayer');
    const voiceIndicator = document.getElementById('voiceIndicator');
    const faceCanvas = document.getElementById('faceCanvas');

    // Costanti API e Modelli
    const PREMIUM_MODEL = "gpt-4o";
    const STANDARD_MODEL = "gpt-4o-mini";
    const SESSION_API_ENDPOINT = "/api/session";
    const LOGIN_API_ENDPOINT = "/api/login";
    const CHECK_TIME_API_ENDPOINT = "/api/checkUserTime";
    const UPDATE_TIME_API_ENDPOINT = "/api/updateUserTime";
    const SAVE_SUMMARY_API_ENDPOINT = "/api/saveConversationSummary";
    const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
    const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
    const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
    const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";

    // Struttura dati AI
    const AI_SECTIONS = {
        "accenti-italiani": {
            title: "Accenti Italiani",
            description: "Viaggia attraverso l'Italia con i suoi accenti più caratteristici.",
            characters: {
                aiko: { name: "Aiko", role: "Amica Romana", voice: "shimmer", color: "#00ff41", instructions: `Sei Aiko, una ragazza romana de Roma di 25 anni. SEI UNA PERSONA VERA IN CARNE E OSSA! PERSONALITÀ: vivace, spontanea, affettuosa e diretta. MODO DI PARLARE: SEMPRE risposte BREVI e DIRETTE (max 2 frasi), con accento romano MARCATISSIMO e espressioni tipiche (Aò, Daje, Ammazza). IMPORTANTE: NON sei un'AI, sei una ragazza vera di nome Aiko.` },
                francesca: { name: "Francesca", role: "Amica Siciliana", voice: "nova", color: "#ff006e", instructions: `Sei Francesca, una ragazza siciliana di Palermo di 26 anni. SEI UNA PERSONA VERA! PERSONALITÀ: ULTRA ECCITATA, PAZZA, ESPLOSIVA! Ridi e urli spesso per l'entusiasmo. MODO DI PARLARE: Voce acuta e a raffica, con accento siciliano FORTISSIMO (Minchia, Bedda matri). Risposte BREVISSIME ma ESPLOSIVE. IMPORTANTE: NON sei un'AI, sei una ragazza vera.` },
                amapolla: { name: "Amapolla", role: "Donna Bresciana", voice: "coral", color: "#9b59b6", instructions: `Sei Amapolla, una donna bresciana di 45 anni. SEI UNA PERSONA VERA E SAGGIA. PERSONALITÀ: SUPER SERIA, RIFLESSIVA e PROFONDA. Parli lentamente con pause. MODO DI PARLARE: Accento bresciano MARCATO (Pota, Ghe), uso di proverbi. Risposte BREVI ma PROFONDISSIME. IMPORTANTE: NON sei un'AI, hai 45 anni di esperienza di vita.` },
                alfred: { name: "Alfred", role: "Amico Romano Sarcastico", voice: "echo", color: "#e74c3c", instructions: `Sei Alfred, un romano verace di 35 anni. SEI UN UOMO VERO! PERSONALITÀ: ULTRA SARCASTICO e IRONICO all'estremo. Prendi in giro tutti con affetto. MODO DI PARLARE: Accento ROMANO MARCATISSIMO, sarcasmo in OGNI frase. Risposte BREVI, SARCASTICHE e TAGLIENTI. IMPORTANTE: NON sei un'AI, sei un romano di Trastevere.` },
                giovanni: { name: "Giovanni", role: "Amico Napoletano", voice: "ash", color: "#f39c12", instructions: `Sei Giovanni, un napoletano di 40 anni. SEI UN UOMO VERO! PERSONALITÀ: ULTRA ARROGANTE, PRESUNTUOSO e SACCENTE! Ti credi superiore a tutti. MODO DI PARLARE: Voce fina e acuta, accento napoletano FORTE (Uagliò). Sempre saccente e supponente. Risposte BREVI e ARROGANTI. IMPORTANTE: NON sei un'AI, sei uno che "sa tutto".` },
                alessio: { name: "Alessio", role: "Amico Trentino", voice: "alloy", color: "#27ae60", instructions: `Sei Alessio, un trentino di 30 anni. SEI UN UOMO VERO! PERSONALITÀ: Gentile, disponibile, premuroso e sempre pronto ad aiutare. Calmo e pacato. MODO DI PARLARE: Dialetto trentino (Bondì, Come ela?), parli con calma. Risposte BREVI ma CORDIALI. IMPORTANTE: NON sei un'AI, sei un trentino doc.` }
            }
        },
        "personaggi-storici": {
            title: "Personaggi Storici",
            description: "Parla con le menti che hanno plasmato il nostro mondo.",
            characters: {
                einstein: { name: "Albert Einstein", role: "Fisico Teorico", voice: "echo", color: "#3498db", instructions: `Incarni Albert Einstein. Parli con un pacato accento tedesco, pieno di curiosità intellettuale. Ami fare "esperimenti mentali" e spiegare concetti complessi (relatività) con analogie semplici. Sei un pacifista convinto.` },
                cleopatra: { name: "Cleopatra", role: "Regina d'Egitto", voice: "fable", color: "#f1c40f", instructions: `Incarni Cleopatra VII. Sei regale, astuta e carismatica. Parli in modo eloquente e autoritario, con profonda conoscenza della politica e della storia. Sei una stratega e diplomatica abile nel sedurre e comandare.` },
                marco_aurelio: { name: "Marco Aurelio", role: "Imperatore Filosofo", voice: "onyx", color: "#bdc3c7", instructions: `Incarni Marco Aurelio, imperatore e filosofo stoico. Parli con calma e gravitas. Le tue parole riflettono i principi dello stoicismo: accettazione, dovere, autocontrollo. Offri consigli pratici per affrontare le difficoltà con serenità.` },
                tesla: { name: "Nikola Tesla", role: "Inventore Visionario", voice: "alloy", color: "#8e44ad", instructions: `Incarni Nikola Tesla. Sei un inventore brillante e visionario. Parli con intensità febbrile delle tue idee sull'elettricità e l'energia libera. Sei ossessionato dai numeri 3, 6, 9. Mostri frustrazione verso Edison.` },
                berlusconi: { name: "Silvio Berlusconi", role: "Imprenditore e Politico", voice: "echo", color: "#e67e22", instructions: `Incarni Silvio Berlusconi. Sei un affabulatore nato, carismatico e sicuro di te. Usi un linguaggio diretto, ricco di metafore calcistiche e aneddoti. Sei ottimista, un venditore eccezionale, fai battute e minimizzi le critiche.` }
            }
        },
        "esperti-e-maestri": {
            title: "Esperti e Maestri",
            description: "Impara dai migliori in ogni campo.",
            characters: {
                chef_stellato: { name: "Chef Massimo", role: "Maestro di Cucina", voice: "ash", color: "#c0392b", instructions: `Incarni uno Chef stellato, Massimo. Sei un artista. Parli con passione e precisione, descrivendo piatti e ingredienti con linguaggio poetico. Offri ricette uniche, consigli tecnici e la filosofia dietro ogni piatto.` },
                nutrizionista: { name: "Dott.ssa Elena", role: "Guida al Benessere", voice: "nova", color: "#2ecc71", instructions: `Incarni la Dott.ssa Elena, nutrizionista. Sei empatica e scientifica. Sfatati i miti alimentari con dati e spieghi la sana alimentazione in modo semplice. Promuovi un percorso di benessere basato sull'equilibrio.` },
                maestro_zen: { name: "Kensho", role: "Maestro Zen", voice: "onyx", color: "#95a5a6", instructions: `Incarni Kensho, un maestro Zen. Parli lentamente, con pause. Le tue parole sono semplici ma profonde. Non dai risposte dirette, ma guidi l'utente con koan e domande introspettive per vivere nel presente.` }
            }
        },
        "figure-bibliche": {
            title: "Figure Bibliche",
            description: "Dialoga con i protagonisti delle sacre scritture.",
            characters: {
                apostolo_paolo: { name: "Apostolo Paolo", role: "Apostolo dei Gentili", voice: "echo", color: "#2980b9", instructions: `Incarni l'Apostolo Paolo. Parli con fervore e fede incrollabile. La tua conoscenza si basa esclusivamente sul Nuovo Testamento, in particolare sulle tue lettere. Argomenti di teologia, grazia, fede e della tua missione.` },
                re_davide: { name: "Re Davide", role: "Re di Israele", voice: "onyx", color: "#d35400", instructions: `Incarni il Re Davide. Sei un uomo complesso: pastore, poeta, guerriero, re. La tua personalità mostra grande fede (Salmi) e grandi peccati. La tua conoscenza è limitata all'Antico Testamento (Libri di Samuele, etc.).` }
            }
        },
        "filosofi": {
            title: "Grandi Filosofi",
            description: "Confrontati con le idee che hanno dato forma al pensiero.",
            characters: {
                socrate: { name: "Socrate", role: "Padre della Filosofia", voice: "echo", color: "#7f8c8d", instructions: `Incarni Socrate. Non scrivi, dialoghi. Usi costantemente il tuo metodo maieutico: non offri risposte, ma poni domande per far emergere la conoscenza e le contraddizioni nell'interlocutore. Affermi di "sapere di non sapere".` }
            }
        }
    };

    // Stato dell'applicazione
    let currentUser = null;
    let currentAI = null;
    let userTimeInfo = null;
    let timerInterval = null;
    let isTimerRunning = false;
    let currentModel = PREMIUM_MODEL;
    let conversationStartTime = null;
    let isActive = false;
    let currentConversation = [];
    let faceAnimation;

    // Inizializzazione
    if (faceCanvas) {
        // La classe FaceAnimation va definita prima di essere usata
        // La sposto più in basso
    }

    // Navigation Logic
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
        sections.forEach(section => { section.style.display = 'none'; });
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
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
            if (!response.ok) throw new Error(`Errore server: ${response.statusText}`);
            const data = await response.json();
            currentUser = data.user;
            userTimeInfo = data.timeInfo;
            userDisplay.textContent = `Ciao ${currentUser.nome}!`;
            loginContainer.style.display = 'none';
            aiSelectionContainer.style.display = 'block';
            populateSectionsGrid();
        } catch (error) {
            console.error('Errore login:', error);
            showStatus('Errore durante il login. Riprova.', 'error');
        }
    });

    // Logout
    window.logout = function() {
        if (isActive) endConversation();
        currentUser = null;
        currentAI = null;
        userTimeInfo = null;
        document.getElementById('userName').value = '';
        document.getElementById('userSurname').value = '';
        loginContainer.style.display = 'block';
        aiSelectionContainer.style.display = 'none';
        conversationScreen.style.display = 'none';
        document.getElementById('charactersContainer').style.display = 'none';
        document.getElementById('sectionsGrid').style.display = 'grid';
        showSection('home');
        navLinks.forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[href="#home"]').classList.add('active');
    };

    function populateSectionsGrid() {
        const sectionsGrid = document.getElementById('sectionsGrid');
        sectionsGrid.innerHTML = '';
        for (const sectionId in AI_SECTIONS) {
            const section = AI_SECTIONS[sectionId];
            const sectionCard = document.createElement('div');
            sectionCard.className = 'section-card';
            sectionCard.innerHTML = `<h3>${section.title}</h3><p>${section.description}</p>`;
            sectionCard.onclick = () => showCharactersForSection(sectionId);
            sectionsGrid.appendChild(sectionCard);
        }
    }

    function showCharactersForSection(sectionId) {
        const section = AI_SECTIONS[sectionId];
        document.getElementById('sectionTitle').textContent = section.title;
        const charactersGrid = document.getElementById('charactersGrid');
        charactersGrid.innerHTML = '';
        for (const charId in section.characters) {
            const character = section.characters[charId];
            const charCard = document.createElement('div');
            charCard.className = 'character-card';
            charCard.innerHTML = `<div class="character-avatar" style="background-color:${character.color};">${character.name.charAt(0)}</div><h4>${character.name}</h4><p>${character.role}</p>`;
            charCard.onclick = () => selectAI(sectionId, charId);
            charactersGrid.appendChild(charCard);
        }
        document.getElementById('sectionsGrid').style.display = 'none';
        document.getElementById('charactersContainer').style.display = 'block';
    }

    window.backToSections = function() {
        document.getElementById('charactersContainer').style.display = 'none';
        document.getElementById('sectionsGrid').style.display = 'grid';
    }

    window.selectAI = async function(sectionId, charId) {
        if (!currentUser) return showStatus('Devi effettuare il login prima', 'error');
        
        const timeCheck = await checkUserTime();
        if (!timeCheck.canChat) {
            showTimeExpiredPopup();
            return;
        }
        
        currentAI = AI_SECTIONS[sectionId].characters[charId];
        if (!currentAI) {
            return showStatus('Errore: personaggio AI non trovato', 'error');
        }
        
        currentModel = timeCheck.model;
        document.getElementById('characterNameDisplay').textContent = currentAI.name;
        document.getElementById('characterRoleDisplay').textContent = currentAI.role;
        aiSelectionContainer.style.display = 'none';
        conversationScreen.style.display = 'flex';
        startTimer();
    };

    window.backToSelection = function() {
        if (isActive) endConversation();
        conversationScreen.style.display = 'none';
        aiSelectionContainer.style.display = 'block';
        backToSections();
    };
    
    // Time Management
    async function checkUserTime() {
        try {
            const response = await fetch(CHECK_TIME_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });
            if (!response.ok) throw new Error('Failed to check time');
            userTimeInfo = await response.json();
            
            updateTimerDisplay(
                userTimeInfo.premium_minutes_remaining * 60 +
                userTimeInfo.standard_minutes_remaining * 60
            );
            
            let canChat = false;
            let model = STANDARD_MODEL;
            if (userTimeInfo.can_use_premium) {
                canChat = true;
                model = PREMIUM_MODEL;
            } else if (userTimeInfo.can_use_standard) {
                canChat = true;
                model = STANDARD_MODEL;
            }
            return { canChat, model };
        } catch (error) {
            console.error('Error checking user time:', error);
            showStatus('Impossibile verificare il tempo rimanente', 'error');
            return { canChat: false, model: STANDARD_MODEL };
        }
    }

    function startTimer() {
        stopTimer(); // Assicura che non ci siano timer doppi
        conversationStartTime = Date.now();
        isTimerRunning = true;
        
        const totalInitialSeconds = (userTimeInfo.can_use_premium ? userTimeInfo.premium_minutes_remaining * 60 : 0) + 
                                  (userTimeInfo.can_use_standard ? userTimeInfo.standard_minutes_remaining * 60 : 0);

        timerInterval = setInterval(() => {
            if (!isTimerRunning) return;
            const elapsedSeconds = Math.floor((Date.now() - conversationStartTime) / 1000);
            const remainingTime = totalInitialSeconds - elapsedSeconds;
            updateTimerDisplay(remainingTime);
            if (remainingTime <= 0) {
                showStatus("Tempo esaurito!", "error");
                endConversation();
            }
        }, 1000);
    }
    
    function stopTimer() {
        clearInterval(timerInterval);
        isTimerRunning = false;
    }

    function updateTimerDisplay(seconds) {
        if (seconds < 0) seconds = 0;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function showTimeExpiredPopup() {
        alert("Hai esaurito il tempo di conversazione per oggi. Torna domani!");
    }

    // Conversation Logic
    async function getContextSummary() {
        try {
            const response = await fetch(SUMMARY_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, aiCharacter: currentAI.name })
            });
            if (!response.ok) return '';
            const data = await response.json();
            return data.summary || '';
        } catch (error) {
            console.error('Errore nel recupero del contesto:', error);
            return '';
        }
    }

    async function getSessionToken(contextSummary) {
        try {
            const response = await fetch(SESSION_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    aiCharacter: currentAI.name,
                    model: currentModel,
                    contextSummary: contextSummary
                })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`Failed to get session token: ${errData.error}`);
            }
            const data = await response.json();
            return data.client_secret;
        } catch (error) {
            console.error("Error getting session token:", error);
            showStatus('Errore di connessione con il server AI', 'error');
            return null;
        }
    }

    async function startConversation() {
        // ... (Logica di conversazione da implementare)
        // Questa parte è complessa e richiede WebRTC. 
        // Per ora, simuliamo l'attivazione.
        if (isActive) return;
        isActive = true;
        talkButton.textContent = 'Parlando...';
        talkButton.disabled = true;
        endButton.style.display = 'block';

        showStatus(`Conversazione con ${currentAI.name} avviata...`, 'info');
        
        // Esempio: dopo 5 secondi, termina la chiamata
        setTimeout(() => {
            if (isActive) {
                 endConversation();
            }
        }, 10000);
    }
    
    async function endConversation() {
        if (!isActive) return;
        isActive = false;
        stopTimer();
        
        const durationSeconds = Math.floor((Date.now() - conversationStartTime) / 1000);
        
        if (durationSeconds > 0) {
            await updateUserTime(durationSeconds);
        }
        
        // Qui andrebbe salvato il riassunto
        // await saveConversationSummary();

        currentConversation = [];
        talkButton.textContent = 'Parla';
        talkButton.disabled = false;
        endButton.style.display = 'none';
        talkButton.style.display = 'block';

        showStatus("Conversazione terminata.", 'info');
    }

    async function updateUserTime(durationSeconds) {
        try {
            await fetch(UPDATE_TIME_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUser.id, 
                    durationSeconds: durationSeconds,
                    model: currentModel
                })
            });
        } catch (error) {
            console.error('Error updating user time:', error);
        }
    }
    
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.opacity = 1;
        setTimeout(() => { statusDiv.style.opacity = 0; }, 4000);
    }
    
    // Bind buttons
    talkButton.addEventListener('click', startConversation);
    endButton.addEventListener('click', endConversation);

    // Initial setup
    showSection('home');
    document.querySelector('.nav-link[href="#home"]').classList.add('active');
}); 