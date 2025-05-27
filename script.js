// script.js
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptsDiv = document.getElementById('transcripts');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17";
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_MEMORY_API_ENDPOINT = "/api/saveToMemory";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary";

let pc;
let dc;
let ephemeralKeyGlobal;
let currentOpenAISessionId = null;

let currentConversationHistory = [];
let currentTurnUserTranscript = "";

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
        if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Errore backend token');}
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

async function startConversation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    transcriptsDiv.innerHTML = "";
    currentConversationHistory = [];
    currentTurnUserTranscript = "";
    currentOpenAISessionId = null;
    console.log("DEBUG: Nuova conversazione.");

    try {
        const summary = await getContextSummary();
        const token = await getEphemeralTokenAndSessionId(summary);
        if (!token) { stopConversation(); return; }

        pc = new RTCPeerConnection();
        pc.ontrack = (event) => {
            if (event.streams?.[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => console.warn("Audio play err:", e));
            }
        };

        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        if (statusDiv) statusDiv.textContent = "Microfono attivo.";

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
                        description: `Cerca nelle conversazioni passate con Alejandro per trovare informazioni specifiche, dettagli personali, preferenze o rispondere a domande su eventi precedenti che lo riguardano. Se ti chiede dell'ultima conversazione o di cosa parlavate, prova a usare come termini di ricerca parole chiave significative delle sue ultime affermazioni o temi generali recenti.`,
                        parameters: {
                            type: "object",
                            properties: { termini_di_ricerca: { type: "string", description: `Termini di ricerca specifici e concisi (2-4 parole chiave) per trovare informazioni nella memoria. Se Alejandro chiede un riepilogo generale o dell'ultima conversazione, identifica i concetti chiave più recenti o specifici di cui potresti aver bisogno.` } },
                            required: ["termini_di_ricerca"]
                        }
                    }]
                }
            });
        };
        dc.onmessage = (event) => { try { handleServerEvent(JSON.parse(event.data)); } catch (e) { console.error("Errore parsing msg server:", e, event.data); }};
        dc.onclose = () => console.log("DEBUG: Data channel chiuso.");
        dc.onerror = (error) => console.error("Errore Data channel:", error);

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato WebRTC: ${pc.connectionState}`);
            if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
                if (statusDiv) statusDiv.textContent = `Connessione: ${pc.connectionState}.`;
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
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    localStream = null;
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

async function sendMemoryContextToAIForNextTurn(instructionsContent) {
    if (!currentOpenAISessionId || !ephemeralKeyGlobal) { // Usa ephemeralKeyGlobal
        console.warn("DEBUG: ID sessione OpenAI o token non disponibili per inviare contesto memoria.");
        return;
    }
    const instructionsForNextTurn = `CONTESTO AGGIUNTIVO DALLA MEMORIA RECENTE (da considerare OLTRE al riassunto iniziale e alle tue istruzioni di base):
    ---- INIZIO MEMORIA RECENTE ----
    ${instructionsContent}
    ---- FINE MEMORIA RECENTE ----
    Ora rispondi alla domanda/affermazione di Alejandro tenendo conto di questo.`;

    console.log("DEBUG: Invio aggiornamento istruzioni con memoria recente per il prossimo turno...");
    sendClientEvent({
        type: "session.update",
        session: {
            instructions: instructionsForNextTurn,
            turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 1000, create_response: true },
             tools: [{
                type: "function",
                name: "cerca_nella_mia_memoria_personale",
                description: `Cerca nelle conversazioni passate con Alejandro per trovare informazioni specifiche, dettagli personali, preferenze o rispondere a domande su eventi precedenti che lo riguardano. Se ti chiede dell'ultima conversazione o di cosa parlavate, prova a usare come termini di ricerca parole chiave significative delle sue ultime affermazioni o temi generali recenti.`,
                parameters: {
                    type: "object",
                    properties: { termini_di_ricerca: { type: "string", description: `Termini di ricerca specifici e concisi (2-4 parole chiave) per trovare informazioni nella memoria. Se Alejandro chiede un riepilogo generale o dell'ultima conversazione, identifica i concetti chiave più recenti o specifici di cui potresti aver bisogno.` } },
                    required: ["termini_di_ricerca"]
                }
            }]
        }
    });
}

function handleServerEvent(event) {
    console.log(`DEBUG (handleServerEvent): type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            currentOpenAISessionId = event.session.id;
            console.log("DEBUG: Sessione OpenAI creata, ID:", currentOpenAISessionId);
            if (statusDiv) statusDiv.textContent = `Aiko è pronta! (Sessione: ...${currentOpenAISessionId.slice(-4)})`;
            break;
        case "session.updated":
            console.log("DEBUG: Sessione OpenAI aggiornata.");
            break;
        case "input_audio_buffer.speech_started":
            if (statusDiv) statusDiv.textContent = "Ti ascolto...";
            currentTurnUserTranscript = "";
            break;

        case "conversation.item.input_audio_transcription.delta":
            if (event.delta && typeof event.delta === 'string') {
                currentTurnUserTranscript += event.delta;
            }
            break;

        case "conversation.item.input_audio_transcription.completed":
            console.log(`DEBUG (INPUT_AUDIO_TRANSCRIPTION.COMPLETED): Transcript='${event.transcript}'`);
            if (event.transcript && typeof event.transcript === 'string' && event.transcript.trim() !== '') {
                currentTurnUserTranscript = event.transcript.trim();
            } else {
                console.warn(`DEBUG (INPUT_AUDIO_TRANSCRIPTION.COMPLETED): Transcript non valido o vuoto.`);
            }
            // Non chiamiamo addTranscript o sendMemoryContextToAIForNextTurn qui,
            // lo faremo in input_audio_buffer.speech_stopped
            break;

        case "input_audio_buffer.speech_stopped":
            if (statusDiv) statusDiv.textContent = "Elaboro il tuo audio...";
            if (currentTurnUserTranscript.trim() !== "") {
                console.log("DEBUG (speech_stopped): Trascrizione utente finale del turno:", currentTurnUserTranscript);
                addTranscript("Tu", currentTurnUserTranscript, `user-turn-${Date.now()}`);
                fetchRecentMemoryForContext(7).then(recentMemory => {
                    sendMemoryContextToAIForNextTurn(recentMemory);
                    // Non è necessario inviare response.create se create_response in turn_detection è true
                    // e la sessione è stata aggiornata con le nuove istruzioni.
                });
            } else {
                console.log("DEBUG (speech_stopped): Nessuna trascrizione utente valida per questo turno.");
                // Se non c'è trascrizione utente, l'IA potrebbe comunque rispondere (es. se c'è silenzio)
                // o potremmo dover forzare una risposta vuota se create_response non scatta.
                // Per ora, lasciamo che turn_detection gestisca questo.
            }
            currentTurnUserTranscript = ""; // Resetta per il prossimo turno
            break;

        case "conversation.item.created":
             if (event.item && event.item.role === "user" && event.item.type === "message") {
                 console.log(`DEBUG (handleServerEvent - USER MESSAGE CREATED): item_id='${event.item.id}'. Contenuto:`, event.item.content);
            }
            break;
        case "conversation.item.updated":
            if (event.item && event.item.role === "user" && event.item.type === "message") {
                 console.warn(`DEBUG (handleServerEvent - USER MESSAGE UPDATED): Item utente aggiornato. Item:`, JSON.parse(JSON.stringify(event.item)));
            }
            break;

        case "response.created":
            currentAIResponseId = event.response.id;
            if (statusDiv) statusDiv.textContent = "Aiko sta pensando...";
            break;
        case "response.text.delta":
        case "response.audio_transcript.delta":
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
