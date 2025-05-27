// script.js
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptsDiv = document.getElementById('transcripts');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17"; // Per l'IA conversazionale
const TRANSCRIBE_API_ENDPOINT = "/api/transcribeAudio"; // NUOVO
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_MEMORY_API_ENDPOINT = "/api/saveToMemory";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";

let pc; // PeerConnection per OpenAI Realtime
let dc; // DataChannel per OpenAI Realtime
let ephemeralKeyGlobal;
let currentOpenAISessionId = null;

let localStream; // Stream audio dal microfono dell'utente
let mediaRecorder; // Per registrare l'audio dell'utente per Whisper
let audioChunks = []; // Per memorizzare i chunk audio registrati

let currentConversationHistory = []; // Per il salvataggio a fine sessione

// --- Funzioni per il riassunto e il token (invariate rispetto all'ultima versione) ---
async function getContextSummary() {
    if (statusDiv) statusDiv.textContent = "Analizzo contesto generale...";
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) { console.warn("Errore recupero riassunto generale"); return ""; }
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
            try { const err = await response.json(); errorMsg = err.error || `Errore ${response.status}`; }
            catch (e) { errorMsg = `Errore ${response.status}: ${await response.text().substring(0,100)}`; }
            throw new Error(errorMsg);
        }
        const data = await response.json();
        if (!data.client_secret) throw new Error('Token non ricevuto.');
        ephemeralKeyGlobal = data.client_secret;
        return data.client_secret;
    } catch (error) {
        console.error("Errore recupero token:", error);
        if (statusDiv) statusDiv.textContent = `Errore token.`;
        throw error;
    }
}
// --- Fine funzioni riassunto e token ---


// --- Funzione per inviare audio a Whisper e ottenere trascrizione ---
async function transcribeUserAudio(audioBlob) {
    if (statusDiv) statusDiv.textContent = "Trascrivo il tuo audio...";
    console.log("DEBUG: Invio audioBlob a /api/transcribeAudio, size:", audioBlob.size);
    try {
        const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': audioBlob.type, // Invia il tipo MIME corretto del blob
            },
            body: audioBlob
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Errore API trascrizione:", response.status, errorData.error || "Dettagli non disponibili");
            if (statusDiv) statusDiv.textContent = "Errore trascrizione audio.";
            return null;
        }
        const data = await response.json();
        console.log("DEBUG: Trascrizione da Whisper ricevuta:", data.transcript);
        if (statusDiv) statusDiv.textContent = "Audio trascritto!";
        return data.transcript;
    } catch (error) {
        console.error("Errore fetch /api/transcribeAudio:", error);
        if (statusDiv) statusDiv.textContent = "Errore grave trascrizione.";
        return null;
    }
}
// --- Fine funzione trascrizione Whisper ---


async function startConversation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    transcriptsDiv.innerHTML = "";
    currentConversationHistory = [];
    currentOpenAISessionId = null;
    localStream = null;
    audioChunks = [];
    console.log("DEBUG: Nuova conversazione.");

    try {
        const summary = await getContextSummary();
        const token = await getEphemeralTokenAndSessionId(summary);
        if (!token) { stopConversation(); return; }

        // Ottieni stream audio UTENTE e avvia MediaRecorder
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (statusDiv) statusDiv.textContent = "Microfono attivo.";

            // Configura MediaRecorder per registrare l'audio dell'utente
            // Scegli un MIME type supportato da Whisper e dal browser (es. audio/webm, audio/mp4, audio/wav)
            // audio/webm;codecs=opus è una buona scelta.
            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} non supportato, provo con default.`);
                mediaRecorder = new MediaRecorder(localStream);
            } else {
                mediaRecorder = new MediaRecorder(localStream, options);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                audioChunks = []; // Resetta per la prossima registrazione
                
                if (audioBlob.size > 0) {
                    const userTranscript = await transcribeUserAudio(audioBlob);
                    if (userTranscript && userTranscript.trim() !== '') {
                        addTranscript("Tu", userTranscript, `user-turn-${Date.now()}`);
                        // Ora che abbiamo la trascrizione utente, invia contesto e chiedi risposta all'IA
                        // (la logica di sendMemoryContextToAIForNextTurn andrebbe rivista per inviare l'User transcript
                        // come parte del prompt all'IA Realtime, o semplicemente confidare che l'IA lo senta)
                        // Per semplicità ora, l'IA Realtime "sente" l'audio, Whisper lo trascrive per la memoria.
                        // L'IA risponderà all'audio che ha sentito.
                    } else {
                        console.log("DEBUG: Trascrizione da Whisper vuota o fallita.");
                    }
                }
            };
            // Non avviare mediaRecorder qui, ma quando l'utente parla tramite OpenAI Realtime
        } catch (getUserMediaError) {
            console.error("Errore accesso al microfono:", getUserMediaError);
            if (statusDiv) statusDiv.textContent = "Errore microfono. Controlla i permessi.";
            stopConversation(); return;
        }

        // Configurazione OpenAI Realtime
        pc = new RTCPeerConnection();
        pc.ontrack = (event) => {
            if (event.streams?.[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => {});
            }
        };
        // Invia le tracce audio dell'utente a OpenAI Realtime
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

        dc = pc.createDataChannel("oai-events", { ordered: true });
        dc.onopen = () => {
            if (statusDiv) statusDiv.textContent = "Connesso ad Aiko. Parla pure!";
            sendClientEvent({
                type: "session.update",
                session: {
                    turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 1000, create_response: true },
                    tools: [{
                        type: "function",
                        name: "cerca_nella_mia_memoria_personale",
                        description: `Cerca nelle conversazioni passate con Alejandro per trovare informazioni specifiche.`,
                        parameters: {
                            type: "object",
                            properties: { termini_di_ricerca: { type: "string", description: `Termini di ricerca specifici.` } },
                            required: ["termini_di_ricerca"]
                        }
                    }]
                }
            });
        };
        dc.onmessage = (event) => {
            let eventData;
            try {
                if (typeof event.data === 'string') eventData = JSON.parse(event.data);
                else { console.warn("dc.onmessage: event.data non stringa:", event.data); return; }
                handleServerEvent(eventData);
            } catch (e) { console.error("Errore parsing JSON in dc.onmessage:", e, "Dati grezzi:", event.data); }
        };
        dc.onclose = () => console.log("DEBUG: Data channel chiuso.");
        dc.onerror = (error) => console.error("Errore Data channel:", error);

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato WebRTC: ${pc.connectionState}`);
            if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
                if (statusDiv) statusDiv.textContent = `Connessione: ${pc.connectionState}.`;
                if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); // Ferma registrazione se la connessione cade
                if (pc.connectionState !== "closed") saveCurrentSessionHistoryAndStop();
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (statusDiv) statusDiv.textContent = "Connessione ad OpenAI...";

        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL_NAME}`, {
            method: "POST", body: offer.sdp, headers: { "Authorization": `Bearer ${ephemeralKeyGlobal}`, "Content-Type": "application/sdp" },
        });
        if (!sdpResponse.ok) throw new Error(`Errore SDP OpenAI (${sdpResponse.status}): ${await sdpResponse.text()}`);
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });

    } catch (error) {
        console.error("Errore avvio conversazione:", error);
        if (statusDiv) statusDiv.textContent = `Errore avvio: ${error.message.substring(0,100)}`;
        stopConversation();
    }
}

// --- Funzioni per UI e salvataggio (principalmente invariate, tranne addTranscript che ora aspetta trascrizione da Whisper) ---
async function saveCurrentSessionHistoryAndStop() {
    console.log("DEBUG (save): Chiamata. History:", JSON.stringify(currentConversationHistory, null, 2).substring(0, 200) + "...");
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop(); // Assicura che la registrazione sia fermata

    if (currentConversationHistory.length > 0) {
        if (statusDiv) statusDiv.textContent = "Salvataggio memoria...";
        // ... (resto della logica di salvataggio come prima) ...
        let savedCount = 0;
        for (const entry of currentConversationHistory) {
            const isValid = entry && typeof entry.speaker === 'string' && entry.speaker.trim() !== '' && typeof entry.content === 'string' && entry.content.trim() !== '';
            if (!isValid) { console.warn("DEBUG (save): Salto entry non valida:", entry); continue; }
            try {
                const resp = await fetch(SAVE_MEMORY_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
                if (resp.ok) { savedCount++; const d = await resp.json(); console.log(`DEBUG (save): Entry salvata. Server: ${d.message}`); }
                else { const errD = await resp.json().catch(() => ({})); console.error(`DEBUG (save): Errore server (${resp.status}):`, errD, "Entry:", entry); }
            } catch (err) { console.error("DEBUG (save): Errore fetch:", err, "Entry:", entry); }
        }
        console.log(`DEBUG (save): ${savedCount} entries inviate.`);
        currentConversationHistory = [];
    }
    if (statusDiv) statusDiv.textContent = "Salvataggio completato.";
    stopConversation();
}

function stopConversation() {
    console.log("DEBUG (stop): Chiamata.");
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop(); // Ferma la registrazione se attiva
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (dc && dc.readyState !== "closed") dc.close();
    dc = null;
    if (pc && pc.connectionState !== "closed") pc.close();
    pc = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    if (statusDiv) statusDiv.textContent = "Pronto per una nuova conversazione!";
    if (aiAudioPlayer) aiAudioPlayer.srcObject = null;
    currentAIResponseId = null;
    currentOpenAISessionId = null;
    audioChunks = []; // Pulisci i chunk audio
}

function sendClientEvent(event) { if (dc && dc.readyState === "open") dc.send(JSON.stringify(event)); }

function addTranscript(speaker, textContent, itemId) { // Questa ora verrà chiamata con la trascrizione da Whisper per l'utente
    console.log(`DEBUG (addTranscript): Speaker='${speaker}', Content='${textContent.substring(0,50)}...'`);
    const id = `${speaker}-${itemId || Date.now()}`;
    let div = document.getElementById(id);
    if (!div) {
        div = document.createElement('div');
        div.id = id;
        div.className = speaker.toLowerCase();
        transcriptsDiv.appendChild(div);
    }
    div.innerHTML = `<strong>${speaker === 'Tu' ? 'Alejandro' : speaker}:</strong> ${textContent}`;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    if ((speaker === "Tu" || speaker === "AI") && typeof textContent === 'string' && textContent.trim() !== '') {
        console.log(`DEBUG (addTranscript): AGGIUNGO A HISTORY: ${speaker}, "${textContent.substring(0,50)}..."`);
        currentConversationHistory.push({ speaker, content: textContent });
    } else {
        console.warn(`DEBUG (addTranscript): SALTO HISTORY: Speaker ${speaker}, Content "${textContent}"`);
    }
}

function appendToTranscript(speaker, textDelta, itemId) { // Per l'IA, rimane uguale
    // ... (codice appendToTranscript invariato dall'ultima versione completa) ...
    const id = `${speaker}-${itemId || currentAIResponseId || 'ai-stream'}`;
    let div = document.getElementById(id);
    let isNew = false;
    if (!div) {
        div = document.createElement('div');
        div.id = id;
        div.className = speaker.toLowerCase();
        div.innerHTML = `<strong>${speaker === 'Tu' ? 'Alejandro' : speaker}:</strong> `;
        transcriptsDiv.appendChild(div);
        isNew = true;
    }
    div.innerHTML += textDelta;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    if (speaker === "AI") {
        const lastEntry = currentConversationHistory.length > 0 ? currentConversationHistory[currentConversationHistory.length - 1] : null;
        if (isNew || !lastEntry || lastEntry.speaker !== "AI") {
            if (typeof textDelta === 'string' && textDelta.trim() !== '') currentConversationHistory.push({ speaker: "AI", content: textDelta });
        } else if (lastEntry.speaker === "AI") {
            if (typeof textDelta === 'string' && textDelta.trim() !== '') lastEntry.content += textDelta;
        }
    }
}

async function handleFunctionCall(functionCall) { // Invariato
    // ... (codice handleFunctionCall invariato dall'ultima versione completa) ...
    if (functionCall.name === "cerca_nella_mia_memoria_personale") {
        if (statusDiv) statusDiv.textContent = "Aiko sta cercando nei ricordi...";
        console.log("DEBUG (handleFnCall): cerca_nella_mia_memoria_personale. Args:", functionCall.arguments);
        try {
            const args = JSON.parse(functionCall.arguments);
            const searchQuery = args.termini_di_ricerca;
            addTranscript("Sistema", `Aiko cerca: "${searchQuery}"...`, `search-${functionCall.call_id}`);
            const searchResponse = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?query=${encodeURIComponent(searchQuery)}`);
            let resultsForAI = "Errore durante la ricerca o nessun risultato.";
            let displayResults = "Errore durante la ricerca.";

            if (searchResponse.ok) {
                try {
                    const searchData = await searchResponse.json();
                    resultsForAI = searchData.results || "Nessun ricordo trovato per quei termini.";
                    displayResults = resultsForAI;
                } catch (parseError) {
                    console.warn("DEBUG (handleFnCall): Risposta da /api/searchMemory non JSON. Leggo come testo.", parseError);
                    const textResponse = await searchResponse.text();
                    resultsForAI = `Risposta testuale (errore?): ${textResponse.substring(0, 200)}`;
                    displayResults = resultsForAI;
                }
            } else {
                let errorText = `Errore server ${searchResponse.status}`;
                try { const errorData = await searchResponse.json(); errorText = `Errore ricerca (${searchResponse.status}): ${errorData.error || ""}`; }
                catch (e) { errorText = `Errore server ${searchResponse.status}: ${await searchResponse.text().catch(() => "")}`; }
                resultsForAI = errorText; displayResults = resultsForAI;
            }
            addTranscript("Sistema", `Risultati per "${searchQuery}": ${displayResults.substring(0, 200)}${displayResults.length > 200 ? "..." : ""}`, `search-res-${functionCall.call_id}`);
            sendClientEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: functionCall.call_id, output: JSON.stringify({ results: resultsForAI }) } });
            sendClientEvent({ type: "response.create" });
            if (statusDiv) statusDiv.textContent = "Aiko ha consultato la memoria.";
        } catch (e) {
            console.error("DEBUG (handleFnCall) Errore:", e);
            addTranscript("Sistema", `Errore critico strumento ricerca: ${e.message}`, `search-catch-${functionCall.call_id}`);
            sendClientEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: functionCall.call_id, output: JSON.stringify({ error: "Errore tecnico nello strumento di ricerca." }) } });
            sendClientEvent({ type: "response.create" });
        }
    }
}

// --- MODIFICHE A handleServerEvent per MediaRecorder ---
function handleServerEvent(event) {
    console.log(`DEBUG (handleServerEvent): type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            currentOpenAISessionId = event.session.id;
            if (statusDiv) statusDiv.textContent = `Aiko è pronta!`;
            break;
        case "session.updated": break;

        case "input_audio_buffer.speech_started": // L'utente ha iniziato a parlare
            if (statusDiv) statusDiv.textContent = "Ti ascolto...";
            if (mediaRecorder && mediaRecorder.state === "inactive") {
                audioChunks = []; // Pulisci i chunk per la nuova registrazione
                mediaRecorder.start();
                console.log("DEBUG: MediaRecorder avviato.");
            }
            break;

        case "input_audio_buffer.speech_stopped": // L'utente ha smesso di parlare
            if (statusDiv) statusDiv.textContent = "Elaboro il tuo audio...";
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop(); // Ferma la registrazione, questo triggererà ondataavailable e onstop
                console.log("DEBUG: MediaRecorder fermato. Attendo trascrizione da Whisper...");
            }
            // L'IA dovrebbe rispondere automaticamente a causa di create_response: true
            // La trascrizione utente da Whisper verrà aggiunta ad addTranscript quando pronta.
            break;

        // Non ci affidiamo più a questi per la trascrizione utente finale
        case "conversation.item.input_audio_transcription.delta":
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.created":
        case "conversation.item.updated":
            // Logghiamo solo se è un item utente, per debug, ma non lo usiamo per la trascrizione finale
            if (event.item && event.item.role === "user") {
                console.log(`DEBUG (handleServerEvent - User Item Event ${event.type}):`, event.item);
            }
            break;

        case "response.created":
            currentAIResponseId = event.response.id;
            if (statusDiv) statusDiv.textContent = "Aiko sta pensando...";
            break;
        case "response.audio_transcript.delta": // Per l'IA
            if (typeof event.delta === 'string') {
                appendToTranscript("AI", event.delta, event.response_id || currentAIResponseId);
            }
            if (statusDiv) statusDiv.textContent = "Aiko risponde...";
            break;
        case "response.done":
            if (event.response.output && event.response.output[0]?.type === "function_call") {
                handleFunctionCall(event.response.output[0]);
            } else {
                if (statusDiv) statusDiv.textContent = "Aiko ha finito di parlare.";
            }
            currentAIResponseId = null;
            break;
        case "error":
            console.error("Errore OpenAI:", event);
            if (statusDiv) statusDiv.textContent = `Errore OpenAI: ${event.message || event.code}`;
            if (["session_expired", "token_expired", "session_not_found", "connection_closed"].includes(event.code)) {
                saveCurrentSessionHistoryAndStop();
            }
            break;
        default:
             console.log(`DEBUG (handleServerEvent - EVENTO NON GESTITO ESPLICITAMENTE): type='${event.type}'.`);
            break;
    }
}
// --- Fine modifiche a handleServerEvent ---

stopButton.addEventListener('click', () => saveCurrentSessionHistoryAndStop());
startButton.addEventListener('click', startConversation);
window.addEventListener('beforeunload', () => { if (pc && pc.connectionState !== "closed") stopConversation(); });
