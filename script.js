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
let localStream;
let currentAIResponseId = null;
let currentConversationHistory = [];

async function getContextSummary() {
    console.log("DEBUG: Richiesta riassunto del contesto...");
    if (statusDiv) statusDiv.textContent = "Analizzo conversazioni precedenti...";
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(`Errore recupero riassunto (${response.status}):`, errorData.error || 'Errore sconosciuto');
            return "";
        }
        const data = await response.json();
        console.log("DEBUG: Riassunto del contesto ricevuto:", data.summary || "(Nessun riassunto disponibile)");
        if (statusDiv) statusDiv.textContent = "Contesto recuperato.";
        return data.summary || "";
    } catch (error) {
        console.warn("Errore fetch recupero riassunto:", error);
        if (statusDiv) statusDiv.textContent = "Errore recupero contesto.";
        return "";
    }
}

async function getEphemeralToken(contextSummary) {
    if (statusDiv) statusDiv.textContent = "Preparo la sessione con Aiko...";
    try {
        const response = await fetch(SESSION_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contextSummary: contextSummary })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Errore backend token (${response.status}): ${errorData.error || 'Sconosciuto'}`);
        }
        const data = await response.json();
        if (!data.client_secret) throw new Error('Token non ricevuto.');
        return data.client_secret;
    } catch (error) {
        console.error("Errore recupero token effimero:", error);
        if (statusDiv) statusDiv.textContent = `Errore token: ${error.message}`;
        throw error;
    }
}

async function startConversation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    transcriptsDiv.innerHTML = "";
    currentAIResponseId = null;
    currentConversationHistory = [];
    console.log("DEBUG: Nuova conversazione, history resettata.");

    try {
        const summary = await getContextSummary();
        const ephemeralKey = await getEphemeralToken(summary);
        if (!ephemeralKey) { stopConversation(); return; }

        pc = new RTCPeerConnection();
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => console.warn("Audio play err:", e));
            }
        };

        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        if (statusDiv) statusDiv.textContent = "Microfono attivo.";

        dc = pc.createDataChannel("oai-events", { ordered: true });
        dc.onopen = () => {
            if (statusDiv) statusDiv.textContent = "Connesso ad Aiko. In attesa...";
            sendClientEvent({
                type: "session.update",
                session: {
                    turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 800, create_response: true },
                    tools: [{
                        type: "function",
                        name: "cerca_nella_mia_memoria_personale",
                        description: `Cerca nelle conversazioni passate con Alejandro per trovare informazioni specifiche, dettagli personali, preferenze o rispondere a domande su eventi precedenti che lo riguardano. Se ti chiede dell'ultima conversazione o di cosa parlavate, prova a usare come termini di ricerca parole chiave significative delle sue ultime affermazioni (se le hai dal riassunto del contesto) o temi generali recenti.`,
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
            method: "POST", body: offer.sdp, headers: { "Authorization": `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        });
        if (!sdpResponse.ok) throw new Error(`Errore SDP OpenAI (${sdpResponse.status}): ${await sdpResponse.text()}`);
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
        if (statusDiv) statusDiv.textContent = "Connessione stabilita con Aiko!";

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
                // Tentiamo di parsare come JSON, ma pronti a gestire non-JSON
                try {
                    const searchData = await searchResponse.json();
                    resultsForAI = searchData.results || "Nessun ricordo trovato per quei termini.";
                    displayResults = resultsForAI;
                    console.log("DEBUG (handleFnCall): Risultati da /api/searchMemory (JSON valido):", searchData);
                } catch (parseError) {
                    // Se il parsing JSON fallisce, leggi la risposta come testo
                    console.warn("DEBUG (handleFnCall): Risposta da /api/searchMemory non era JSON valido. Leggo come testo. Errore:", parseError);
                    const textResponse = await searchResponse.text(); // Leggi come testo
                    resultsForAI = `Risposta testuale dal server (potrebbe essere un errore): ${textResponse.substring(0, 200)}`;
                    displayResults = resultsForAI;
                    console.log("DEBUG (handleFnCall): Risposta testuale da /api/searchMemory:", textResponse);
                }
            } else {
                // Se la risposta non è ok (es. 404, 500)
                let errorText = `Errore server ${searchResponse.status}`;
                try {
                    const errorData = await searchResponse.json();
                    errorText = `Errore dal server di ricerca (${searchResponse.status}): ${errorData.error || "Dettagli non disponibili"}`;
                } catch (e) {
                    // Fallback se anche il parsing dell'errore JSON fallisce
                    errorText = `Errore server ${searchResponse.status}: ${await searchResponse.text().catch(() => "Impossibile leggere dettagli errore")}`;
                }
                resultsForAI = errorText;
                displayResults = resultsForAI;
                console.error("DEBUG (handleFnCall): Errore da /api/searchMemory:", resultsForAI);
            }

            addTranscript("Sistema", `Risultati per "${searchQuery}": ${displayResults.substring(0, 200)}${displayResults.length > 200 ? "..." : ""}`, `search-res-${functionCall.call_id}`);
            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: functionCall.call_id,
                    output: JSON.stringify({ results: resultsForAI })
                }
            });
            sendClientEvent({ type: "response.create" });
            if (statusDiv) statusDiv.textContent = "Aiko ha consultato la memoria.";

        } catch (e) {
            console.error("DEBUG (handleFnCall) Errore nel blocco try-catch principale:", e);
            addTranscript("Sistema", `Errore critico nello strumento di ricerca: ${e.message}`, `search-catch-${functionCall.call_id}`);
            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: functionCall.call_id,
                    output: JSON.stringify({ error: "Non sono riuscita ad elaborare la richiesta di ricerca a causa di un errore tecnico." })
                }
            });
            sendClientEvent({ type: "response.create" });
        }
    }
}

function handleServerEvent(event) {
    console.log(`DEBUG (handleServerEvent): type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            if (statusDiv) statusDiv.textContent = `Sessione con Aiko creata.`;
            break;
        case "session.updated":
            break;
        case "input_audio_buffer.speech_started":
            if (statusDiv) statusDiv.textContent = "Ti ascolto...";
            break;
        case "input_audio_buffer.speech_stopped":
            if (statusDiv) statusDiv.textContent = "Elaboro il tuo audio...";
            break;

        case "conversation.item.created":
            if (event.item && event.item.role === "user" && event.item.type === "message") {
                console.log(`DEBUG (handleServerEvent - USER MESSAGE CREATED): item_id='${event.item.id}'. Verifico contenuto... Item:`, JSON.parse(JSON.stringify(event.item)));
                let userTranscript = null;
                if (typeof event.item.content === 'string') { // Caso 1: item.content è direttamente la stringa
                    userTranscript = event.item.content;
                }
                else if (event.item.content && Array.isArray(event.item.content) && event.item.content.length > 0) { // Caso 2: item.content è un array
                    if (typeof event.item.content[0] === 'string') { // Sotto-caso 2a: il primo elemento dell'array è la stringa
                        userTranscript = event.item.content[0];
                    } else if (event.item.content[0].type === "input_audio" && typeof event.item.content[0].transcript === 'string') { // Sotto-caso 2b: la struttura che abbiamo visto
                        userTranscript = event.item.content[0].transcript;
                    }
                }

                if (userTranscript && userTranscript.trim() !== '') {
                    console.log(`DEBUG (handleServerEvent - USER MESSAGE CREATED): TROVATA TRASCRIZIONE! Transcript='${userTranscript}'`);
                    addTranscript("Tu", userTranscript, event.item.id);
                } else {
                    console.warn(`DEBUG (handleServerEvent - USER MESSAGE CREATED): Trascrizione non trovata o vuota nel formato atteso. Item content:`, event.item.content);
                }
            }
            break;

        case "conversation.item.updated":
            if (event.item && event.item.role === "user" && event.item.type === "message" &&
                event.item.status === "completed") {
                console.log(`DEBUG (handleServerEvent - USER MESSAGE UPDATED): item_id='${event.item.id}'. Verifico contenuto... Item:`, JSON.parse(JSON.stringify(event.item)));
                let userTranscriptUpdated = null;
                if (typeof event.item.content === 'string') {
                     userTranscriptUpdated = event.item.content;
                } else if (event.item.content && Array.isArray(event.item.content) && event.item.content.length > 0) {
                    if (typeof event.item.content[0] === 'string') {
                        userTranscriptUpdated = event.item.content[0];
                    } else if (event.item.content[0].type === "input_audio" && typeof event.item.content[0].transcript === 'string') {
                        userTranscriptUpdated = event.item.content[0].transcript;
                    }
                }

                if (userTranscriptUpdated && userTranscriptUpdated.trim() !== '') {
                    console.log(`DEBUG (handleServerEvent - USER MESSAGE UPDATED): TROVATA TRASCRIZIONE! Transcript='${userTranscriptUpdated}'`);
                    addTranscript("Tu", userTranscriptUpdated, event.item.id);
                } else {
                    console.warn(`DEBUG (handleServerEvent - USER MESSAGE UPDATED): Item utente aggiornato, ma trascrizione non trovata o vuota. Item content:`, event.item.content);
                }
            }
            break;

        case "conversation.item.input_audio_transcription.completed":
            console.log(`DEBUG (handleServerEvent - INPUT_AUDIO_TRANSCRIPTION.COMPLETED - Fallback): Transcript='${event.transcript}'`);
            if (event.transcript && typeof event.transcript === 'string' && event.transcript.trim() !== '') {
                addTranscript("Tu", event.transcript, event.item_id);
            } else {
                console.warn(`DEBUG (handleServerEvent - INPUT_AUDIO_TRANSCRIPTION.COMPLETED - Fallback): Transcript non valido.`);
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
