// script.js (COMPLETO E AGGIORNATO)
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptsDiv = document.getElementById('transcripts');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17";
const TRANSCRIBE_API_ENDPOINT = "/api/transcribeAudio";
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_MEMORY_API_ENDPOINT = "/api/saveToMemory";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";

let pc;
let dc;
let ephemeralKeyGlobal;
let currentOpenAISessionId = null;
let localStream = null;
let mediaRecorder;
let audioChunks = [];

let currentConversationHistory = [];

async function fetchRecentMemoryForContext(limit = 7) {
    console.log(`DEBUG: Fetching last ${limit} memory entries for continuous context...`);
    if (statusDiv) statusDiv.textContent = "Aiko consulta la memoria recente...";
    try {
        const response = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?fetchLast=${limit}`);
        if (response.ok) {
            const data = await response.json();
            console.log("DEBUG: Memoria recente per contesto ricevuta:", data.results || "(vuota)");
            if (statusDiv) statusDiv.textContent = "Memoria recente recuperata.";
            return data.results || "";
        }
        console.warn("DEBUG: Impossibile fetchare memoria recente. Status:", response.status);
        if (statusDiv) statusDiv.textContent = "Errore consultazione memoria recente.";
        return "";
    } catch (error) {
        console.error("DEBUG: Errore fetch memoria recente:", error);
        if (statusDiv) statusDiv.textContent = "Errore grave consultazione memoria.";
        return "";
    }
}

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
            try {
                const errText = await response.text();
                const err = JSON.parse(errText || "{}");
                errorMsg = err.error || `Errore ${response.status}: ${errText.substring(0,100)}`;
            } catch (e) {
                 errorMsg = `Errore ${response.status}: risposta non JSON o illeggibile.`;
            }
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

async function transcribeUserAudio(audioBlob) {
    if (statusDiv) statusDiv.textContent = "Trascrivo il tuo audio...";
    console.log("DEBUG: Invio audioBlob a /api/transcribeAudio, size:", audioBlob.size, "type:", audioBlob.type);
    try {
        const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' }, // Invia il tipo MIME corretto
            body: audioBlob
        });

        if (!response.ok) {
            let errorDetails = "Dettagli errore trascrizione non disponibili";
            try {
                const errorData = await response.json();
                errorDetails = errorData.error || errorData.details || JSON.stringify(errorData);
            } catch (e) {
                errorDetails = await response.text();
            }
            console.error("Errore API trascrizione:", response.status, errorDetails);
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
        const token = await getEphemeralTokenAndSessionId(summary); // ephemeralKeyGlobal è settato dentro questa funzione
        if (!token) { stopConversation(); return; }

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (statusDiv) statusDiv.textContent = "Microfono attivo.";

            const options = { mimeType: 'audio/webm;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} non supportato, provo con default per MediaRecorder.`);
                mediaRecorder = new MediaRecorder(localStream);
            } else {
                mediaRecorder = new MediaRecorder(localStream, options);
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                audioChunks = [];
                
                if (audioBlob.size > 0) {
                    const userTranscript = await transcribeUserAudio(audioBlob);
                    if (userTranscript && userTranscript.trim() !== '') {
                        addTranscript("Tu", userTranscript, `user-turn-${Date.now()}`);
                        // Ora che la trascrizione utente è salvata, l'IA la troverà con la ricerca
                        // o sarà nel prossimo riassunto. La risposta dell'IA è già triggerata
                        // da create_response:true nell'API Realtime.
                    } else {
                        console.log("DEBUG: Trascrizione da Whisper vuota o fallita.");
                    }
                }
            };
        } catch (getUserMediaError) {
            console.error("Errore accesso al microfono:", getUserMediaError);
            if (statusDiv) statusDiv.textContent = "Errore microfono. Controlla i permessi.";
            stopConversation(); return;
        }

        pc = new RTCPeerConnection();
        pc.ontrack = (event) => {
            if (event.streams?.[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => {});
            }
        };
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
                if (typeof event.data === 'string') {
                    eventData = JSON.parse(event.data);
                    handleServerEvent(eventData);
                } else {
                    console.warn("dc.onmessage: event.data non è una stringa. Dati ricevuti:", event.data);
                }
            } catch (e) {
                console.error("Errore durante il parsing del JSON da event.data o nell'esecuzione di handleServerEvent:", e);
                console.error("Dati grezzi che hanno causato l'errore (se event.data era una stringa):", typeof event.data === 'string' ? event.data : "event.data non era una stringa");
                if (statusDiv) statusDiv.textContent = "Errore: Messaggio dal server non valido.";
            }
        };
        dc.onclose = () => console.log("DEBUG: Data channel chiuso.");
        dc.onerror = (error) => console.error("Errore Data channel:", error);

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato WebRTC: ${pc.connectionState}`);
            if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
                if (statusDiv) statusDiv.textContent = `Connessione: ${pc.connectionState}.`;
                if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
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

async function saveCurrentSessionHistoryAndStop() {
    console.log("DEBUG (save): Chiamata. History:", JSON.stringify(currentConversationHistory, null, 2).substring(0, 200) + "...");
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();

    if (currentConversationHistory.length > 0) {
        if (statusDiv) statusDiv.textContent = "Salvataggio memoria...";
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
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
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
    audioChunks = [];
}

function sendClientEvent(event) { if (dc && dc.readyState === "open") dc.send(JSON.stringify(event)); }

function addTranscript(speaker, textContent, itemId) {
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

function appendToTranscript(speaker, textDelta, itemId) {
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

async function handleFunctionCall(functionCall) {
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

function handleServerEvent(event) {
    console.log(`DEBUG (handleServerEvent): type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            currentOpenAISessionId = event.session.id;
            console.log("DEBUG: Sessione OpenAI creata, ID:", currentOpenAISessionId);
            if (statusDiv) statusDiv.textContent = `Aiko è pronta!`;
            break;
        case "session.updated":
            console.log("DEBUG: Sessione OpenAI aggiornata.");
            break;
        case "input_audio_buffer.speech_started":
            if (statusDiv) statusDiv.textContent = "Ti ascolto...";
            if (mediaRecorder && mediaRecorder.state === "inactive") {
                audioChunks = [];
                mediaRecorder.start();
                console.log("DEBUG: MediaRecorder avviato.");
            }
            break;
        case "input_audio_buffer.speech_stopped":
            if (statusDiv) statusDiv.textContent = "Elaboro il tuo audio...";
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop(); // Questo triggererà ondataavailable e onstop (che chiama transcribeUserAudio)
                console.log("DEBUG: MediaRecorder fermato. Attendo trascrizione da Whisper...");
            }
            // L'IA Realtime risponderà all'audio che ha "sentito".
            // La trascrizione da Whisper verrà aggiunta alla history separatamente quando pronta.
            break;

        // Non ci affidiamo più a questi per la trascrizione utente primaria
        case "conversation.item.input_audio_transcription.delta":
        case "conversation.item.input_audio_transcription.completed":
        case "conversation.item.created":
        case "conversation.item.updated":
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

stopButton.addEventListener('click', () => saveCurrentSessionHistoryAndStop());
startButton.addEventListener('click', startConversation);
window.addEventListener('beforeunload', () => { if (pc && pc.connectionState !== "closed") stopConversation(); });
