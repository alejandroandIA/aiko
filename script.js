// script.js
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');
const aikoFace = document.getElementById('aikoFace'); // Nuovo elemento per il viso

const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17";
const TRANSCRIBE_API_ENDPOINT = "/api/transcribeAudio";
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_MEMORY_API_ENDPOINT = "/api/saveToMemory";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";
const EXTRACT_INFO_API_ENDPOINT = "/api/extractImportantInfo";
const SAVE_IMPORTANT_INFO_API_ENDPOINT = "/api/saveImportantInfo";
const GET_IMPORTANT_INFO_API_ENDPOINT = "/api/getImportantInfo";
const MANAGE_MEMORY_API_ENDPOINT = "/api/manageMemory";
const USER_PROFILE_API_ENDPOINT = "/api/userProfile";

let pc;
let dc;
let ephemeralKeyGlobal;
let currentOpenAISessionId = null; // Usato per tracciare se la sessione è attiva
let webrtcStreamForOpenAI = null; // Stream dedicato per OpenAI WebRTC
let mediaRecorderStream = null;   // Stream dedicato per MediaRecorder (per Whisper)
let mediaRecorder;
let audioChunks = [];
let whisperGracePeriodTimer = null;
let isRecordingForWhisper = false;
let lastTranscriptionAttemptPromise = Promise.resolve(); // Aggiunta per tracciare l'ultima trascrizione

let currentConversationHistory = [];
let sessionStartTime = null;
let sessionTopics = new Set();

// Funzione per animare il viso di Aiko
function animateAikoFace(isTalking) {
    if (aikoFace) {
        if (isTalking) {
            aikoFace.classList.add('talking');
        } else {
            aikoFace.classList.remove('talking');
        }
    }
}

async function getContextSummary() {
    if (statusDiv) statusDiv.textContent = "Analizzo contesto generale...";
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) { console.warn("Errore recupero riassunto generale, status:", response.status); return ""; }
        const data = await response.json();
        console.log("DEBUG: Riassunto generale ricevuto:", data.summary || "(Nessun riassunto)");
        if (statusDiv) statusDiv.textContent = "Contesto generale analizzato.";
        return data.summary || "";
    } catch (error) { console.warn("Errore fetch riassunto generale:", error); return ""; }
}

async function getEphemeralTokenAndSessionId(contextSummary) {
    if (statusDiv) statusDiv.textContent = "Preparo connessione con Aiko...";
    try {
        const response = await fetch(SESSION_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contextSummary: contextSummary })
        });
        if (!response.ok) {
            let errorMsg = 'Errore backend token';
            try { const errText = await response.text(); const err = JSON.parse(errText || "{}"); errorMsg = err.error || `Errore ${response.status}: ${errText.substring(0, 100)}`; }
            catch (e) { errorMsg = `Errore ${response.status}: risposta non JSON o illeggibile.`;}
            throw new Error(errorMsg);
        }
        const data = await response.json();
        if (!data.client_secret) throw new Error('Token non ricevuto.');
        ephemeralKeyGlobal = data.client_secret;
        return data.client_secret;
    } catch (error) { console.error("Errore recupero token:", error); if (statusDiv) statusDiv.textContent = `Errore token: ${error.message.substring(0,60)}`; throw error; }
}

async function transcribeUserAudio(audioBlob) {
    if (statusDiv) statusDiv.textContent = "Trascrivo il tuo audio (Whisper)...";
    console.log("DEBUG: Invio audioBlob a /api/transcribeAudio, size:", audioBlob.size, "type:", audioBlob.type);
    try {
        const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
            body: audioBlob
        });
        const responseBodyText = await response.text();
        if (!response.ok) {
            let errorDetails = `Errore ${response.status}: ${responseBodyText}`;
            try { const errorData = JSON.parse(responseBodyText); errorDetails = errorData.error?.details || errorData.error || JSON.stringify(errorData); } catch (e) {}
            console.error("Errore API trascrizione Whisper (client):", response.status, errorDetails);
            if (response.status === 408) { // Timeout personalizzato dal backend
                 if (statusDiv) statusDiv.textContent = "La trascrizione sta impiegando troppo tempo. Riprova parlando più brevemente.";
            } else {
                 if (statusDiv) statusDiv.textContent = "Errore trascrizione Whisper.";
            }
            return null;
        }
        const data = JSON.parse(responseBodyText);
        console.log("DEBUG: Trascrizione da Whisper ricevuta:", data.transcript);
        return data.transcript;
    } catch (error) { console.error("Errore fetch /api/transcribeAudio (Whisper):", error); if (statusDiv) statusDiv.textContent = "Errore grave trascrizione Whisper."; return null; }
}

async function startConversation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    currentConversationHistory = [];
    currentOpenAISessionId = null; 
    audioChunks = [];
    isRecordingForWhisper = false;
    sessionStartTime = new Date();
    sessionTopics.clear();
    if (whisperGracePeriodTimer) clearTimeout(whisperGracePeriodTimer);
    console.log("DEBUG: Nuova conversazione.");

    try {
        const summary = await getContextSummary();
        const token = await getEphemeralTokenAndSessionId(summary);
        if (!token) { stopConversation(); return; }

        // Stream per OpenAI Realtime (rimane attivo)
        try {
            webrtcStreamForOpenAI = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.error("Errore ottenimento stream per OpenAI WebRTC:", e);
            if (statusDiv) statusDiv.textContent = "Errore microfono (WebRTC).";
            stopConversation(); return;
        }
        
        // MediaRecorder verrà inizializzato e avviato da input_audio_buffer.speech_started
        // usando uno stream separato o lo stesso se gestito correttamente.
        // Per ora, creiamo l'istanza qui.
        const mimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
        let supportedMimeType = '';
        for (const mimeType of mimeTypes) { if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) { supportedMimeType = mimeType; break; }}
        console.log("DEBUG: MediaRecorder userà MIME type (potenziale):", supportedMimeType || "default del browser");
        
        // Nota: MediaRecorder verrà effettivamente creato con uno stream fresco in speech_started

        pc = new RTCPeerConnection();
        pc.ontrack = (event) => { 
            if (event.streams?.[0]) { 
                aiAudioPlayer.srcObject = event.streams[0]; 
                aiAudioPlayer.play().catch(e => console.warn("Errore durante la riproduzione dell'audio di Aiko:", e));
            }
        };
        if (webrtcStreamForOpenAI) {
            webrtcStreamForOpenAI.getTracks().forEach(track => pc.addTrack(track, webrtcStreamForOpenAI));
        }

        dc = pc.createDataChannel("oai-events", { ordered: true });
        dc.onopen = () => {
            if (statusDiv) statusDiv.textContent = "Connesso ad Aiko. Parla pure!";
            sendClientEvent({
                type: "session.update",
                session: {
                    turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 2000, create_response: true }, 
                    tools: [{type: "function",name: "cerca_nella_mia_memoria_personale",description: `Cerca nelle conversazioni passate con Alejandro per trovare informazioni specifiche. Usa termini di ricerca concisi e focalizzati.`,parameters: {type: "object",properties: { termini_di_ricerca: { type: "string", description: `Termini di ricerca specifici e concisi, ad esempio: "ricetta carbonara" o "ultimo libro consigliato".` } },required: ["termini_di_ricerca"]}}]
                }
            });
            currentOpenAISessionId = "active_session"; // Segnala che la sessione è attiva
        };
        
        dc.onmessage = (event) => {
            let eventData;
            try {
                if (typeof event.data === 'string') { 
                    eventData = JSON.parse(event.data); 
                    handleServerEvent(eventData); 
                }
                else { 
                    console.warn("dc.onmessage: event.data non è una stringa:", event.data); 
                }
            } catch (e) {
                console.error("[dc.onmessage catch] Errore:", e);
                console.error("[dc.onmessage catch] Dati grezzi (se stringa):", typeof event.data === 'string' ? event.data.substring(0, 500) + "..." : "event.data non era stringa");
                if (statusDiv) statusDiv.textContent = "Errore: Messaggio server non interpretabile.";
            }
        };
        
        dc.onclose = () => {
            console.log("DEBUG: Data channel chiuso.");
            if (currentOpenAISessionId) { 
                console.warn("DEBUG dc.onclose: Data channel chiuso inaspettatamente. Stato WebRTC:", pc?.connectionState);
                if(!pc || pc.connectionState === "closed" || pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                    if (!saveCurrentSessionHistoryAndStop.called) saveCurrentSessionHistoryAndStop();
                }
            }
        };
        
        dc.onerror = (error) => {
            console.error("Errore Data channel:", error);
            if (statusDiv) statusDiv.textContent = "Errore critico di connessione.";
            if (currentOpenAISessionId && !saveCurrentSessionHistoryAndStop.called) { 
                saveCurrentSessionHistoryAndStop(); 
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato WebRTC: ${pc.connectionState}`);
            if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
                if (statusDiv) statusDiv.textContent = `Connessione: ${pc.connectionState}.`;
                if (mediaRecorder && mediaRecorder.state === "recording") { 
                    mediaRecorder.stop(); 
                }
                if (pc.connectionState !== "closed" && currentOpenAISessionId && !saveCurrentSessionHistoryAndStop.called) {
                    console.log("DEBUG pc.onconnectionstatechange: Triggering saveCurrentSessionHistoryAndStop.");
                    saveCurrentSessionHistoryAndStop();
                }
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (statusDiv) statusDiv.textContent = "Connessione ad OpenAI...";
        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL_NAME}`, { method: "POST", body: offer.sdp, headers: { "Authorization": `Bearer ${ephemeralKeyGlobal}`, "Content-Type": "application/sdp" }, });
        if (!sdpResponse.ok) { const errorText = await sdpResponse.text(); console.error(`Errore SDP OpenAI (${sdpResponse.status}): ${errorText}`); throw new Error(`Errore SDP OpenAI (${sdpResponse.status}): ${errorText.substring(0, 200)}`);}
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });

    } catch (error) {
        console.error("Errore avvio conversazione:", error);
        if (statusDiv) statusDiv.textContent = `Errore avvio: ${error.message.substring(0,100)}`;
        stopConversation();
    }
}

async function saveCurrentSessionHistoryAndStop() {
    if (saveCurrentSessionHistoryAndStop.called) { return; }
    saveCurrentSessionHistoryAndStop.called = true;
    animateAikoFace(false); // Aiko smette di "parlare"
    console.log("DEBUG (saveCurrentSessionHistoryAndStop): Chiamata.");
    if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("DEBUG (saveCurrentSessionHistoryAndStop): MediaRecorder era in registrazione, lo fermo.");
        mediaRecorder.stop(); // Questo triggera onstop, che aggiornerà lastTranscriptionAttemptPromise
    }

    // Attendi il completamento dell'ultima trascrizione Whisper prima di procedere.
    try {
        console.log("DEBUG (saveCurrentSessionHistoryAndStop): Attendo ultima potenziale trascrizione Whisper.");
        await lastTranscriptionAttemptPromise;
    } catch (e) {
        console.error("DEBUG (saveCurrentSessionHistoryAndStop): Errore durante attesa ultima trascrizione Whisper:", e);
    }
    
    if (currentConversationHistory.length > 0) {
        if (statusDiv) statusDiv.textContent = "Salvataggio memoria e analisi conversazione...";
        
        // 1. Prima salva tutta la conversazione
        console.log(`DEBUG (save): Inizio salvataggio di ${currentConversationHistory.length} entries.`);
        let savedCount = 0;
        const historyToSave = [...currentConversationHistory];
        currentConversationHistory = []; 
        
        for (const entry of historyToSave) {
            const isValid = entry && typeof entry.speaker === 'string' && entry.speaker.trim() !== '' && typeof entry.content === 'string' && entry.content.trim() !== '';
            if (!isValid) { console.warn("DEBUG (save): Salto entry non valida:", entry); continue; }
            try {
                const resp = await fetch(SAVE_MEMORY_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
                if (resp.ok) { savedCount++; }
                else { const errD = await resp.json().catch(() => ({error: "Errore parsing risposta server"})); console.error(`DEBUG (save): Errore server (${resp.status}):`, errD, "Entry:", entry); }
            } catch (err) { console.error("DEBUG (save): Errore fetch salvataggio:", err, "Entry:", entry); }
        }
        
        // 2. Estrai informazioni importanti dalla conversazione
        try {
            console.log("DEBUG: Estrazione informazioni importanti...");
            const extractResp = await fetch(EXTRACT_INFO_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation: historyToSave })
            });
            
            if (extractResp.ok) {
                const extractedData = await extractResp.json();
                console.log("DEBUG: Informazioni estratte:", extractedData);
                
                // Salva ogni informazione importante
                if (extractedData.important_facts && extractedData.important_facts.length > 0) {
                    for (const fact of extractedData.important_facts) {
                        try {
                            await fetch(SAVE_IMPORTANT_INFO_API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(fact)
                            });
                        } catch (e) {
                            console.error("Errore salvataggio informazione importante:", e);
                        }
                    }
                    console.log(`DEBUG: ${extractedData.important_facts.length} informazioni importanti salvate`);
                }
            }
        } catch (e) {
            console.error("Errore estrazione informazioni importanti:", e);
        }
        
        // 3. NUOVO: Salva metadati della sessione
        try {
            const sessionEnd = new Date();
            const sentiment = analyzeSessionSentiment(historyToSave);
            
            await fetch('/api/sessionMetadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_start: sessionStartTime,
                    session_end: sessionEnd,
                    messages_count: historyToSave.length,
                    topics: Array.from(sessionTopics),
                    sentiment: sentiment,
                    key_insights: extractKeyInsights(historyToSave)
                })
            });
        } catch (e) {
            console.error("Errore salvataggio metadati sessione:", e);
        }
        
        // 4. NUOVO: Aggiorna profilo utente periodicamente
        try {
            // Aggiorna il profilo ogni 10 conversazioni o una volta al giorno
            const shouldUpdateProfile = savedCount > 0 && Math.random() < 0.1; // 10% di probabilità
            if (shouldUpdateProfile) {
                console.log("DEBUG: Aggiornamento profilo utente...");
                await fetch(USER_PROFILE_API_ENDPOINT, {
                    method: 'POST'
                });
            }
        } catch (e) {
            console.error("Errore aggiornamento profilo:", e);
        }
        
        console.log(`DEBUG (save): ${savedCount} entries inviate per il salvataggio su ${historyToSave.length}.`);
        if (statusDiv) statusDiv.textContent = `Memoria aggiornata (${savedCount} voci).`;
    } else {
        console.log("DEBUG (save): Nessuna entry nella cronologia da salvare.");
        if (statusDiv && !statusDiv.textContent.includes("Errore")) statusDiv.textContent = "Nessuna nuova memoria da salvare.";
    }
    stopConversation(); 
    delete saveCurrentSessionHistoryAndStop.called;
}
saveCurrentSessionHistoryAndStop.called = false;

function stopConversation() {
    console.log("DEBUG (stopConversation): Chiamata.");
    animateAikoFace(false); // Assicura che Aiko smetta di "parlare"
    if (whisperGracePeriodTimer) clearTimeout(whisperGracePeriodTimer);
    isRecordingForWhisper = false;

    if (mediaRecorder && (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")) {
        console.log("DEBUG (stopConversation): MediaRecorder attivo/in pausa, lo fermo.");
        mediaRecorder.stop();
    }
    if (mediaRecorderStream) { // Rilascia lo stream di MediaRecorder
        mediaRecorderStream.getTracks().forEach(track => track.stop());
        mediaRecorderStream = null;
        console.log("DEBUG (stopConversation): Stream MediaRecorder rilasciato.");
    }
    if (webrtcStreamForOpenAI) { // Rilascia lo stream di WebRTC
        webrtcStreamForOpenAI.getTracks().forEach(track => track.stop());
        webrtcStreamForOpenAI = null;
        console.log("DEBUG (stopConversation): Stream WebRTC rilasciato.");
    }
    
    if (dc && dc.readyState !== "closed") { 
        dc.close(); 
        console.log("DEBUG (stopConversation): Data channel chiuso.");
    }
    dc = null;
    
    if (pc && pc.connectionState !== "closed") { 
        pc.close(); 
        console.log("DEBUG (stopConversation): PeerConnection chiuso.");
    }
    pc = null;
    
    startButton.disabled = false;
    stopButton.disabled = true;
    if (statusDiv && !statusDiv.textContent.toLowerCase().includes("salvataggio") && !statusDiv.textContent.toLowerCase().includes("errore")) {
        statusDiv.textContent = "Pronto per una nuova conversazione!";
    }
    if (aiAudioPlayer) aiAudioPlayer.srcObject = null;
    currentOpenAISessionId = null;
    audioChunks = [];
    console.log("DEBUG (stopConversation): Stato ripulito.");
}

function sendClientEvent(event) {
    if (dc && dc.readyState === "open") { 
        dc.send(JSON.stringify(event));
    }
    else { 
        console.warn("DEBUG sendClientEvent: Data channel non aperto o non disponibile. Evento non inviato:", event.type);
    }
}

function addTranscriptToHistory(speaker, textContent, itemId) {
    // Non salvare trascrizioni Whisper fallite o troppo brevi
    if (speaker === "Tu" && (
        textContent.includes("(Trascrizione Whisper fallita") ||
        textContent.includes("(Audio troppo breve") ||
        textContent.includes("(Errore grave durante trascrizione")
    )) {
        // Potremmo voler loggare questo fallimento da qualche parte se necessario, ma non nella history principale.
        console.warn(`DEBUG (addTranscriptToHistory - Whisper): Salto entry problematica: ${speaker}, "${textContent.substring(0,50)}..."`);
        return;
    }

    const displayName = (speaker === 'Tu' || speaker === 'Alejandro') ? 'Tu' : (speaker === 'AI' || speaker === 'Aiko') ? 'AI' : speaker;
    
    console.log(`DEBUG (addTranscriptToHistory): Speaker='${displayName}', Content='${textContent.substring(0,100)}...'`);
    
    if ((speaker === "Tu" || speaker === "AI" || speaker === "Aiko" || speaker === "Alejandro" || speaker === "Sistema") && typeof textContent === 'string' && textContent.trim() !== '') {
        const speakerForHistory = (speaker === 'Tu' || speaker === 'Alejandro') ? 'Tu' : (speaker === 'AI' || speaker === 'Aiko') ? 'AI' : 'Sistema'; // Semplificato
        
        const lastEntry = currentConversationHistory[currentConversationHistory.length -1];
        // Evita duplicati esatti consecutivi dalla stessa fonte con lo stesso itemId (se presente)
        if (lastEntry && lastEntry.speaker === speakerForHistory && lastEntry.content === textContent && (itemId === undefined || lastEntry.itemId === itemId)) {
             console.log(`DEBUG (addTranscriptToHistory): Salto entry duplicata: ${speakerForHistory}, "${textContent.substring(0,30)}..."`);
            return;
        }
        
        console.log(`DEBUG (addTranscriptToHistory): AGGIUNGO A HISTORY (per Supabase): ${speakerForHistory}, "${textContent.substring(0,100)}..."`);
        currentConversationHistory.push({ speaker: speakerForHistory, content: textContent, itemId: itemId, timestamp: new Date().toISOString() });

        // Estrai argomenti per i metadati della sessione
        if (textContent.length > 20) { // Solo per contenuti significativi
            const words = textContent.toLowerCase().match(/\b\w{6,}\b/g) || []; // Corretta regex: singolo backslash
            words.forEach(word => {
                if (!['quando', 'perché', 'come', 'dove', 'cosa', 'questo', 'quello', 'essere', 'avere', 'molto', 'sempre', 'allora'].includes(word)) { // Filtra stop words comuni
                    sessionTopics.add(word);
                }
            });
        }
    } else { 
        console.warn(`DEBUG (addTranscriptToHistory): SALTO HISTORY (contenuto non valido): Speaker ${speaker}, Content "${textContent}"`);
    }
}

function appendToHistory(speaker, textDelta, itemId) {
    const speakerForHistory = "AI"; // Dato che questa è usata per lo streaming della risposta di Aiko
    
    if (speaker === "AI" || speaker === "Aiko") {
        const lastEntry = currentConversationHistory.length > 0 ? currentConversationHistory[currentConversationHistory.length - 1] : null;
        // Se l'ultimo messaggio è di AI, ha lo stesso itemId (risposta in streaming), allora appendi.
        if (lastEntry && lastEntry.speaker === speakerForHistory && lastEntry.itemId === itemId) {
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                lastEntry.content += textDelta;
            }
        } else { // Altrimenti, crea una nuova entry se c'è testo.
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                console.log(`DEBUG (appendToHistory): NUOVA ENTRY HISTORY (AI per Supabase): "${textDelta.substring(0,50)}..." (itemId: ${itemId})`);
                currentConversationHistory.push({ speaker: speakerForHistory, content: textDelta, itemId: itemId, timestamp: new Date().toISOString() });
            }
        }
    }
}

async function handleFunctionCall(functionCall) {
    if (functionCall.name === "cerca_nella_mia_memoria_personale") {
        if (statusDiv) statusDiv.textContent = "Aiko sta cercando nei ricordi...";
        animateAikoFace(true); // Aiko "parla" mentre cerca
        console.log("DEBUG (handleFnCall): cerca_nella_mia_memoria_personale. Args:", functionCall.arguments);
        try {
            const args = JSON.parse(functionCall.arguments); 
            const searchQuery = args.termini_di_ricerca;
            // addTranscriptToHistory("Sistema", \`Aiko cerca: "\${searchQuery}"...\`, \`search-\${functionCall.call_id}\`); // Non mostrare all'utente
            
            const searchResponse = await fetch(\`\${SEARCH_MEMORY_API_ENDPOINT}?query=\${encodeURIComponent(searchQuery)}\`);
            let resultsForAI = "Errore durante la ricerca o nessun risultato."; 
            let displayResults = "Errore durante la ricerca.";
            
            if (searchResponse.ok) {
                try { 
                    const searchData = await searchResponse.json(); 
                    resultsForAI = searchData.results || "Nessun ricordo trovato per quei termini."; 
                    displayResults = resultsForAI; 
                }
                catch (parseError) { 
                    console.warn("DEBUG (handleFnCall): Risposta da /api/searchMemory non JSON.", parseError); 
                    const textResponse = await searchResponse.text(); 
                    resultsForAI = \`Risposta testuale (errore?): \${textResponse.substring(0, 200)}\`; 
                    displayResults = resultsForAI;
                }
            } else {
                let errorText = \`Errore server \${searchResponse.status}\`;
                try { 
                    const errorData = await searchResponse.json(); 
                    errorText = \`Errore ricerca (\${searchResponse.status}): \${errorData.error || ""}\`; 
                } catch (e) { 
                    errorText = \`Errore server \${searchResponse.status}: \${await searchResponse.text().catch(() => "")}\`; 
                }
                resultsForAI = errorText; 
                displayResults = resultsForAI;
            }
            
            // addTranscriptToHistory("Sistema", \`Risultati per "\${searchQuery}": \${displayResults.substring(0, 200)}\${displayResults.length > 200 ? "..." : ""}\`, \`search-res-\${functionCall.call_id}\`); // Non mostrare
            sendClientEvent({ 
                type: "conversation.item.create", 
                item: { 
                    type: "function_call_output", 
                    call_id: functionCall.call_id, 
                    output: JSON.stringify({ results: resultsForAI }) 
                } 
            });
            
            if (statusDiv) statusDiv.textContent = "Aiko ha consultato la memoria.";
            // animateAikoFace(false); // Non fermare qui, la risposta dell'AI lo farà
        } catch (e) {
            console.error("DEBUG (handleFnCall) Errore:", e);
            // addTranscriptToHistory("Sistema", \`Errore critico strumento ricerca: \${e.message}\`, \`search-catch-\${functionCall.call_id}\`); // Non mostrare
            sendClientEvent({ 
                type: "conversation.item.create", 
                item: { 
                    type: "function_call_output", 
                    call_id: functionCall.call_id, 
                    output: JSON.stringify({ error: "Errore tecnico nello strumento di ricerca." }) 
                } 
            });
            animateAikoFace(false); // Ferma l'animazione in caso di errore grave qui
        }
    }
}

function handleServerEvent(event) {
    // console.log(\`DEBUG (handleServerEvent): type='\${event.type}', obj:\`, JSON.parse(JSON.stringify(event)));
    switch (event.type) {
        case "session.created": currentOpenAISessionId = event.session.id; if (statusDiv) statusDiv.textContent = \`Aiko è pronta!\`; console.log(\`DEBUG: Sessione OpenAI creata: \${currentOpenAISessionId}\`); break;
        case "session.updated": break;
        case "input_audio_buffer.speech_started":
            if (statusDiv) statusDiv.textContent = "Ti ascolto...";
            clearTimeout(whisperGracePeriodTimer); 
            if (!isRecordingForWhisper) { // Solo se non stiamo già registrando
                // Otteniamo un nuovo stream per MediaRecorder ogni volta che l'utente inizia a parlare
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(stream => {
                        mediaRecorderStream = stream; // Salva riferimento per stopparlo dopo
                        audioChunks = [];
                        const mimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
                        let supportedMimeType = '';
                        for (const mimeType of mimeTypes) { if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) { supportedMimeType = mimeType; break; }}
                        mediaRecorder = new MediaRecorder(mediaRecorderStream, supportedMimeType ? { mimeType: supportedMimeType } : {});
                        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data);};
                        mediaRecorder.onstop = async () => { // Questo onstop è SOLO per Whisper
                            console.log("DEBUG mediaRecorder.onstop (per Whisper, dopo grace period): Chiamato.");
                            isRecordingForWhisper = false; 
                            if (mediaRecorderStream) { mediaRecorderStream.getTracks().forEach(track => track.stop()); mediaRecorderStream = null;}

                            const blobMimeType = mediaRecorder.mimeType || supportedMimeType || 'audio/webm';
                            const audioBlob = new Blob(audioChunks, { type: blobMimeType });
                            audioChunks = []; 

                            // NUOVO LOG QUI
                            console.log("DEBUG mediaRecorder.onstop: audioBlob.size = " + audioBlob.size + ", audioBlob.type = " + audioBlob.type);

                            if (audioBlob.size > 1000) { // Aumentato da 150 a 1000 byte
                                // Aggiorna lastTranscriptionAttemptPromise con la nuova operazione di trascrizione
                                lastTranscriptionAttemptPromise = transcribeUserAudio(audioBlob)
                                    .then(userTranscript => {
                                        if (userTranscript && userTranscript.trim() !== '') { addTranscriptToHistory("Tu", userTranscript, \`user-whisper-\${Date.now()}\`); }
                                        else { addTranscriptToHistory("Tu", "(Trascrizione Whisper fallita o audio non rilevato)", \`user-whisper-fail-\${Date.now()}\`); }
                                    }).catch(e => {
                                        console.error("Errore trascrizione in onstop handler:", e);
                                        addTranscriptToHistory("Tu", "(Errore grave durante trascrizione Whisper)", \`user-whisper-error-\${Date.now()}\`);
                                    });
                            } else { 
                                addTranscriptToHistory("Tu", "(Audio troppo breve per trascrizione Whisper)", \`user-whisper-short-\${Date.now()}\`);
                                lastTranscriptionAttemptPromise = Promise.resolve(); // Resetta a una promise risolta se non si trascrive
                            }
                        };
                        mediaRecorder.start();
                        isRecordingForWhisper = true;
                        console.log("DEBUG: MediaRecorder avviato (per Whisper).");
                    })
                    .catch(err => {
                        console.error("Errore ottenimento stream per MediaRecorder in speech_started:", err);
                        if (statusDiv) statusDiv.textContent = "Errore microfono (Whisper).";
                    });
            }
            break;
        case "input_audio_buffer.speech_stopped":
            if (statusDiv) statusDiv.textContent = "Elaboro il tuo audio..."; 
            console.log("DEBUG: OpenAI Realtime speech_stopped. Avvio grace period per Whisper.");
            clearTimeout(whisperGracePeriodTimer); 
            whisperGracePeriodTimer = setTimeout(() => {
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    console.log("DEBUG: Grace period terminato, fermo MediaRecorder per Whisper.");
                    mediaRecorder.stop(); 
                }
            }, 1500); // Grace period aumentato da 1200ms a 1500ms
            break;
        case "conversation.item.input_audio_transcription.delta": case "conversation.item.input_audio_transcription.completed": break;
        case "conversation.item.created": 
            if (event.item && event.item.role === "user") { console.log(`DEBUG (handleServerEvent - User Item (Realtime API) Created ${event.item.content[0]?.type}):`, event.item); }
            else if (event.item && event.item.role === "assistant") { console.log(`DEBUG (handleServerEvent - Assistant Item Created):`, event.item); }
            else if (event.item && event.item.type === "function_call_output") { console.log(`DEBUG (handleServerEvent - Function Call Output Item Created):`, event.item); }
            break;
        case "conversation.item.updated": break;
        case "response.created": 
            if (statusDiv) statusDiv.textContent = "Aiko sta pensando..."; 
            animateAikoFace(true); // Aiko inizia a "parlare" o "pensare"
            console.log("DEBUG: OpenAI response.created:", event.response.id); 
            break;
        case "response.audio_transcript.delta": 
            if (typeof event.delta === 'string') { 
                // NON FACCIAMO NULLA CON LA TRASCRIZIONE REALTIME DELL'UTENTE
            }
            break;
        case "response.done": 
            console.log("DEBUG: OpenAI response.done:", event.response.id, "Output:", event.response.output); 
            if (event.response.output && event.response.output[0]?.type === "function_call") { 
                handleFunctionCall(event.response.output[0]); 
            }
            const hasTextOutput = event.response.output?.some(part => part.type === 'text');
            const hasAudioOutput = event.response.output?.some(part => part.type === 'audio');

            if (hasAudioOutput) {
                const audioOutput = event.response.output.find(part => part.type === 'audio');
                if (audioOutput && audioOutput.transcript) {
                    addTranscriptToHistory("AI", audioOutput.transcript, event.response.id);
                }
            }

            if (!hasAudioOutput && !event.response.output?.some(part => part.type === 'function_call')) {
                 // Se non c'è output audio e non è una function call (che ha la sua animazione)
                 // Aiko smette di "parlare" se non c'è audio. 
                 // L'audio gestirà la sua fine tramite output_audio_buffer.stopped
                animateAikoFace(false);
            }
            
            if (hasTextOutput || hasAudioOutput) {
                if (!hasAudioOutput && (statusDiv.textContent.startsWith("Aiko sta pensando...") || statusDiv.textContent.startsWith("Aiko risponde..."))) {
                    statusDiv.textContent = "Aiko ha finito.";
                }
            } else if (!event.response.output?.some(part => part.type === 'function_call')) {
                if (statusDiv.textContent.startsWith("Aiko sta pensando...") || statusDiv.textContent.startsWith("Aiko risponde...")) {
                    statusDiv.textContent = "Aiko ha concluso.";
                }
            }
            break;
        case "error":
            console.error("Errore OpenAI Realtime:", JSON.stringify(event, null, 2)); 
            animateAikoFace(false); // Ferma animazione in caso di errore
            let errorMessage = "Errore OpenAI sconosciuto"; 
            let errorCode = "unknown_error";
            
            if (event.error) { 
                errorMessage = event.error.message || JSON.stringify(event.error); 
                errorCode = event.error.code || errorCode; 
            } else { 
                errorMessage = event.message || errorMessage; 
                errorCode = event.code || errorCode; 
            }
            
            if (statusDiv) statusDiv.textContent = \`Errore OpenAI: \${errorMessage.substring(0, 60)}\`;
            const criticalErrorCodes = ["session_expired", "token_expired", "session_not_found", "connection_closed", "session_failed", "invalid_request_error", "authentication_error", "api_error", "invalid_api_key", "rate_limit_exceeded"];
            
            if (criticalErrorCodes.includes(errorCode) && !saveCurrentSessionHistoryAndStop.called) { 
                if (statusDiv) statusDiv.textContent += " Sessione terminata o errore grave. Provo a salvare."; 
                saveCurrentSessionHistoryAndStop(); 
            }
            break;
        case "input_audio_buffer.committed": case "rate_limits.updated": case "response.output_item.added": case "response.content_part.added": case "response.audio.done": case "response.audio_transcript.done": case "response.content_part.done": case "response.output_item.done": case "output_audio_buffer.started": case "response.function_call_arguments.delta": case "response.function_call_arguments.done": break;
        case "output_audio_buffer.stopped": 
            animateAikoFace(false); // Aiko smette di parlare quando l'audio finisce
            if (statusDiv && (statusDiv.textContent.startsWith("Aiko risponde...") || statusDiv.textContent.startsWith("Aiko ha finito.") || statusDiv.textContent.startsWith("Aiko sta pensando...") )) {
                statusDiv.textContent = "Aiko ha finito di parlare."; 
            } 
            break;
        case "response.output_item.added": 
            if (event.item?.type === "text") {
                if (statusDiv && statusDiv.textContent.startsWith("Aiko sta pensando...")) {
                     statusDiv.textContent = "Aiko risponde..."; 
                     animateAikoFace(true); // Assicura che Aiko "parli"
                }
            }
            break; 
        case "response.content_part.added": 
            if (event.part?.type === "text" && typeof event.part.text === 'string') {
                appendToHistory("AI", event.part.text, event.response_id);
                animateAikoFace(true); // Aiko sta parlando attivamente
            }
            break;
        case "response.audio.done": case "response.audio_transcript.done": case "response.content_part.done": case "response.output_item.done": case "output_audio_buffer.started": case "response.function_call_arguments.delta": case "response.function_call_arguments.done": break;
        default: console.log(`DEBUG (handleServerEvent - EVENTO SCONOSCIUTO O NON GESTITO): type='\${event.type}'. obj:`, JSON.parse(JSON.stringify(event))); break;
    }
}

// --- Event Listeners UI ---
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', () => {
    console.log("DEBUG: Pulsante TERMINA premuto.");
    if (statusDiv) statusDiv.textContent = "Chiusura conversazione e salvataggio...";
    animateAikoFace(false); // Aiko smette di "parlare"
    if (!saveCurrentSessionHistoryAndStop.called) { saveCurrentSessionHistoryAndStop(); }
});
window.addEventListener('beforeunload', (event) => { if (stopButton.disabled === false) { console.log("DEBUG: Evento beforeunload, conversazione attiva."); }});

stopConversation();

// NUOVE funzioni helper
function analyzeSessionSentiment(history) {
    // Analizza il sentiment generale della conversazione
    let positiveWords = 0;
    let negativeWords = 0;
    
    const positive = ['bene', 'buono', 'felice', 'grazie', 'perfetto', 'ottimo', 'bravo', 'bello'];
    const negative = ['problema', 'errore', 'male', 'difficile', 'non funziona', 'sbagliato'];
    
    history.forEach(entry => {
        const text = entry.content.toLowerCase();
        positive.forEach(word => {
            if (text.includes(word)) positiveWords++;
        });
        negative.forEach(word => {
            if (text.includes(word)) negativeWords++;
        });
    });
    
    if (positiveWords > negativeWords * 2) return 'positivo';
    if (negativeWords > positiveWords * 2) return 'negativo';
    return 'neutro';
}

function extractKeyInsights(history) {
    // Estrai le frasi più lunghe e significative
    const insights = history
        .filter(entry => entry.content.length > 50)
        .map(entry => entry.content)
        .slice(0, 3)
        .join(' | ');
    
    return insights.substring(0, 500);
}
