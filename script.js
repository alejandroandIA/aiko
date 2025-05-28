// script.js
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

// --- Funzioni Helper ---

async function getContextSummary() {
    if (statusDiv) statusDiv.textContent = "Analizzo contesto generale...";
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) {
            console.warn("Errore recupero riassunto generale, status:", response.status);
            return "";
        }
        const data = await response.json();
        console.log("DEBUG: Riassunto generale ricevuto:", data.summary || "(Nessun riassunto)");
        if (statusDiv) statusDiv.textContent = "Contesto generale analizzato.";
        return data.summary || "";
    } catch (error) {
        console.warn("Errore fetch riassunto generale:", error);
        return "";
    }
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
                errorMsg = err.error || `Errore ${response.status}: ${errText.substring(0, 100)}`;
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
        if (statusDiv) statusDiv.textContent = `Errore token: ${error.message.substring(0,60)}`;
        throw error;
    }
}

async function transcribeUserAudio(audioBlob) {
    if (statusDiv) statusDiv.textContent = "Trascrivo il tuo audio...";
    console.log("DEBUG: Invio audioBlob a /api/transcribeAudio, size:", audioBlob.size, "type:", audioBlob.type);
    try {
        const response = await fetch(TRANSCRIBE_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
            body: audioBlob
        });

        const responseBodyText = await response.text();
        // console.log("DEBUG transcribeUserAudio: Risposta grezza da /api/transcribeAudio:", responseBodyText); // Può essere molto verboso

        if (!response.ok) {
            let errorDetails = `Errore ${response.status}: ${responseBodyText}`;
            try {
                const errorData = JSON.parse(responseBodyText);
                errorDetails = errorData.error?.details || errorData.error || JSON.stringify(errorData);
            } catch (e) { /* Usa responseBodyText */ }
            console.error("Errore API trascrizione (client):", response.status, errorDetails);
            if (statusDiv) statusDiv.textContent = "Errore trascrizione audio.";
            return null;
        }
        const data = JSON.parse(responseBodyText);
        console.log("DEBUG: Trascrizione da Whisper ricevuta:", data.transcript);
        // if (statusDiv) statusDiv.textContent = "Audio trascritto!"; // Lo stato cambia troppo velocemente, meglio gestirlo altrove
        return data.transcript;
    } catch (error) {
        console.error("Errore fetch /api/transcribeAudio:", error);
        if (statusDiv) statusDiv.textContent = "Errore grave trascrizione.";
        return null;
    }
}

// --- Logica Principale della Conversazione ---

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
        if (!token) {
            stopConversation();
            return;
        }

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (statusDiv) statusDiv.textContent = "Microfono attivo.";

            const mimeTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
            let supportedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
                    supportedMimeType = mimeType;
                    break;
                }
            }
            console.log("DEBUG: MediaRecorder userà MIME type:", supportedMimeType || "default del browser");
            mediaRecorder = new MediaRecorder(localStream, supportedMimeType ? { mimeType: supportedMimeType } : {});

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const blobMimeType = mediaRecorder.mimeType || supportedMimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: blobMimeType });
                audioChunks = []; 
                
                console.log("DEBUG mediaRecorder.onstop: audioBlob.size:", audioBlob.size);

                if (audioBlob.size > 200) { 
                    const userTranscript = await transcribeUserAudio(audioBlob); 

                    if (userTranscript && userTranscript.trim() !== '') {
                        addTranscript("Tu", userTranscript, `user-turn-${Date.now()}`);

                        if (dc && dc.readyState === "open" && currentOpenAISessionId) {
                            console.log("DEBUG script.js: Invio trascrizione utente (da Whisper) al modello Realtime:", userTranscript);
                            sendClientEvent({
                                type: "conversation.item.create",
                                item: {
                                    type: "message",
                                    role: "user",
                                    content: [{ type: "input_text", text: userTranscript }] 
                                }
                            });

                            console.log("DEBUG script.js: Richiesta esplicita di creazione risposta per Aiko.");
                            sendClientEvent({ type: "response.create" });
                        }
                    } else {
                        console.warn("DEBUG script.js: Trascrizione da Whisper vuota o fallita, o audio troppo breve dopo trim.");
                        addTranscript("Tu", "(Trascrizione audio fallita o audio non rilevato)", `user-fail-${Date.now()}`);
                        // Se la trascrizione fallisce, non chiediamo ad Aiko di rispondere, il che è corretto.
                    }
                } else {
                     console.log("DEBUG script.js: AudioBlob troppo piccolo (size:", audioBlob.size, "), non invio a Whisper.");
                     addTranscript("Tu", "(Audio troppo breve per trascrizione)", `user-short-${Date.now()}`);
                     // Se l'audio è troppo breve, non chiediamo ad Aiko di rispondere.
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
                aiAudioPlayer.play().catch(e => {/* console.warn("Autoplay AI audio bloccato", e) */});
            }
        };
        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        dc = pc.createDataChannel("oai-events", { ordered: true });
        
        dc.onopen = () => {
            if (statusDiv) statusDiv.textContent = "Connesso ad Aiko. Parla pure!";
            sendClientEvent({
                type: "session.update",
                session: {
                    // *** MODIFICA CHIAVE QUI ***
                    turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 1800, create_response: false }, 
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
            if (stopButton.disabled === false) { 
                console.warn("DEBUG dc.onclose: Data channel chiuso inaspettatamente. Stato WebRTC:", pc?.connectionState);
                if(!pc || pc.connectionState === "closed" || pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                    if (!saveCurrentSessionHistoryAndStop.called) saveCurrentSessionHistoryAndStop();
                }
            }
        };
        dc.onerror = (error) => {
            console.error("Errore Data channel:", error);
            if (statusDiv) statusDiv.textContent = "Errore critico di connessione.";
             if (stopButton.disabled === false && !saveCurrentSessionHistoryAndStop.called) {
                saveCurrentSessionHistoryAndStop();
             }
        };

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato WebRTC: ${pc.connectionState}`);
            if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
                if (statusDiv) statusDiv.textContent = `Connessione: ${pc.connectionState}.`;
                if (mediaRecorder && mediaRecorder.state === "recording") {
                    console.log("DEBUG pc.onconnectionstatechange: MediaRecorder in registrazione, lo fermo.");
                    mediaRecorder.stop();
                }
                if (pc.connectionState !== "closed" && stopButton.disabled === false && !saveCurrentSessionHistoryAndStop.called) {
                    console.log("DEBUG pc.onconnectionstatechange: Triggering saveCurrentSessionHistoryAndStop.");
                    saveCurrentSessionHistoryAndStop();
                }
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (statusDiv) statusDiv.textContent = "Connessione ad OpenAI...";

        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL_NAME}`, {
            method: "POST", body: offer.sdp, headers: { "Authorization": `Bearer ${ephemeralKeyGlobal}`, "Content-Type": "application/sdp" },
        });
        if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text();
            console.error(`Errore SDP OpenAI (${sdpResponse.status}): ${errorText}`);
            throw new Error(`Errore SDP OpenAI (${sdpResponse.status}): ${errorText.substring(0, 200)}`);
        }
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });
    } catch (error) {
        console.error("Errore avvio conversazione:", error);
        if (statusDiv) statusDiv.textContent = `Errore avvio: ${error.message.substring(0,100)}`;
        stopConversation();
    }
}

async function saveCurrentSessionHistoryAndStop() {
    if (saveCurrentSessionHistoryAndStop.called) {
        // console.log("DEBUG (saveCurrentSessionHistoryAndStop): Chiamata già in corso, esco.");
        return;
    }
    saveCurrentSessionHistoryAndStop.called = true;

    console.log("DEBUG (saveCurrentSessionHistoryAndStop): Chiamata.");
    if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("DEBUG (saveCurrentSessionHistoryAndStop): MediaRecorder era in registrazione, lo fermo.");
        mediaRecorder.stop();
    }

    await new Promise(resolve => setTimeout(resolve, 500)); 

    if (currentConversationHistory.length > 0) {
        if (statusDiv) statusDiv.textContent = "Salvataggio memoria...";
        console.log(`DEBUG (save): Inizio salvataggio di ${currentConversationHistory.length} entries.`);
        let savedCount = 0;
        const historyToSave = [...currentConversationHistory];
        currentConversationHistory = []; 

        for (const entry of historyToSave) {
            const isValid = entry && typeof entry.speaker === 'string' && entry.speaker.trim() !== '' && typeof entry.content === 'string' && entry.content.trim() !== '';
            if (!isValid) { console.warn("DEBUG (save): Salto entry non valida:", entry); continue; }
            try {
                const resp = await fetch(SAVE_MEMORY_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
                if (resp.ok) { savedCount++; /* const d = await resp.json(); console.log(`DEBUG (save): Entry salvata. Server: ${d.message}`); */ }
                else { const errD = await resp.json().catch(() => ({error: "Errore parsing risposta server"})); console.error(`DEBUG (save): Errore server (${resp.status}):`, errD, "Entry:", entry); }
            } catch (err) { console.error("DEBUG (save): Errore fetch salvataggio:", err, "Entry:", entry); }
        }
        console.log(`DEBUG (save): ${savedCount} entries inviate per il salvataggio su ${historyToSave.length}.`);
        if (statusDiv) statusDiv.textContent = `Salvataggio completato (${savedCount} voci).`;
    } else {
        console.log("DEBUG (save): Nessuna entry nella cronologia da salvare.");
        if (statusDiv && !statusDiv.textContent.includes("Errore")) statusDiv.textContent = "Nessuna nuova memoria da salvare.";
    }
    
    // stopConversation() viene chiamato dopo che il salvataggio è completato o se non c'è nulla da salvare.
    // Ma il flag .called deve essere resettato *dopo* che stopConversation ha fatto il suo lavoro,
    // o meglio, stopConversation dovrebbe essere l'ultima cosa.
    // Chiamiamo stopConversation e poi resettiamo il flag.
    stopConversation(); 
    delete saveCurrentSessionHistoryAndStop.called;
}
saveCurrentSessionHistoryAndStop.called = false;

function stopConversation() {
    console.log("DEBUG (stopConversation): Chiamata.");
    if (mediaRecorder && (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")) {
        console.log("DEBUG (stopConversation): MediaRecorder attivo/in pausa, lo fermo.");
        mediaRecorder.stop();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        console.log("DEBUG (stopConversation): Tracce microfono fermate.");
    }
    if (dc && dc.readyState !== "closed") {
        // Non inviare "session.close" se l'API non lo supporta o se causa problemi.
        // dc.send(JSON.stringify({ type: "session.close" })); 
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
    console.log("DEBUG (stopConversation): Stato ripulito, pronto per nuova sessione.");
}

function sendClientEvent(event) { 
    if (dc && dc.readyState === "open") {
        // console.log("DEBUG sendClientEvent:", JSON.stringify(event).substring(0,150) + "...");
        dc.send(JSON.stringify(event));
    } else {
        console.warn("DEBUG sendClientEvent: Data channel non aperto o non disponibile. Evento non inviato:", event.type);
    }
}

function addTranscript(speaker, textContent, itemId) {
    const uniqueId = `${speaker.toLowerCase().replace(/\s+/g, '-')}-${itemId || Date.now()}`;
    let div = document.getElementById(uniqueId);

    const displayName = (speaker === 'Tu' || speaker === 'Alejandro') ? 'Alejandro' : (speaker === 'AI' || speaker === 'Aiko') ? 'Aiko' : speaker;
    const className = (speaker === 'Tu' || speaker === 'Alejandro') ? 'tu' : (speaker === 'AI' || speaker === 'Aiko') ? 'ai' : 'sistema';

    if (!div) {
        div = document.createElement('div');
        div.id = uniqueId;
        div.className = className;
        transcriptsDiv.appendChild(div);
    }
    
    const strong = document.createElement('strong');
    strong.textContent = `${displayName}: `;
    div.innerHTML = ''; // Pulisci prima di aggiungere
    div.appendChild(strong);
    div.appendChild(document.createTextNode(textContent));

    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;
    console.log(`DEBUG (addTranscript): Speaker='${displayName}', Content='${textContent.substring(0,50)}...'`);

    if ((speaker === "Tu" || speaker === "AI" || speaker === "Sistema" || speaker === "Aiko" || speaker === "Alejandro") && typeof textContent === 'string' && textContent.trim() !== '') {
        const speakerForHistory = (speaker === 'Tu' || speaker === 'Alejandro') ? 'Tu' : (speaker === 'AI' || speaker === 'Aiko') ? 'AI' : speaker;
        
        const lastEntry = currentConversationHistory[currentConversationHistory.length -1];
        // Evita di aggiungere un messaggio identico se l'ID è lo stesso (raro per addTranscript ma cautela)
        if (lastEntry && lastEntry.itemId === itemId && lastEntry.content === textContent) {
            // console.log("DEBUG (addTranscript): Evitato duplicato esatto con lo stesso itemId per la history.");
        } else {
            console.log(`DEBUG (addTranscript): AGGIUNGO A HISTORY: ${speakerForHistory}, "${textContent.substring(0,50)}..."`);
            currentConversationHistory.push({ speaker: speakerForHistory, content: textContent, itemId: itemId }); // Aggiunto itemId per potenziale deduplica
        }
    } else {
        console.warn(`DEBUG (addTranscript): SALTO HISTORY: Speaker ${speaker}, Content "${textContent}"`);
    }
}

function appendToTranscript(speaker, textDelta, itemId) {
    const domSpeakerClass = (speaker === "Aiko" || speaker === "AI") ? "ai" : speaker.toLowerCase().replace(/\s+/g, '-');
    const displaySpeakerName = "Aiko"; 

    const domItemId = itemId || 'ai-streaming-response';
    const uniqueId = `${domSpeakerClass}-${domItemId}`;

    let div = document.getElementById(uniqueId);
    let isNew = false;
    if (!div) {
        isNew = true;
        div = document.createElement('div');
        div.id = uniqueId;
        div.className = domSpeakerClass;
        const strong = document.createElement('strong');
        strong.textContent = `${displaySpeakerName}: `;
        div.appendChild(strong);
        transcriptsDiv.appendChild(div);
    }
    
    div.appendChild(document.createTextNode(textDelta));
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    if (speaker === "AI" || speaker === "Aiko") {
        const lastEntry = currentConversationHistory.length > 0 ? currentConversationHistory[currentConversationHistory.length - 1] : null;
        if (isNew || !lastEntry || lastEntry.speaker !== "AI" || lastEntry.itemId !== domItemId) { 
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                 console.log(`DEBUG (appendToTranscript): NUOVA ENTRY HISTORY (AI): "${textDelta.substring(0,50)}..." (itemId: ${domItemId})`);
                currentConversationHistory.push({ speaker: "AI", content: textDelta, itemId: domItemId });
            }
        } else if (lastEntry.speaker === "AI" && lastEntry.itemId === domItemId) { 
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                lastEntry.content += textDelta;
            }
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
    // console.log(`DEBUG (handleServerEvent): type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            currentOpenAISessionId = event.session.id;
            if (statusDiv) statusDiv.textContent = `Aiko è pronta!`;
            console.log(`DEBUG: Sessione OpenAI creata: ${currentOpenAISessionId}`);
            break;
        case "session.updated": 
            // console.log("DEBUG: Sessione OpenAI aggiornata:", event.session);
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
                mediaRecorder.stop(); 
                console.log("DEBUG: MediaRecorder fermato. Attendo trascrizione da Whisper...");
            }
            break;

        case "conversation.item.input_audio_transcription.delta":
        case "conversation.item.input_audio_transcription.completed":
            // Ignoriamo la trascrizione interna di OpenAI Realtime
            break;
        case "conversation.item.created": 
            if (event.item && event.item.role === "user") {
                 console.log(`DEBUG (handleServerEvent - User Item Created ${event.item.content[0]?.type}):`, event.item);
            } else if (event.item && event.item.role === "assistant") {
                 console.log(`DEBUG (handleServerEvent - Assistant Item Created):`, event.item);
            } else if (event.item && event.item.type === "function_call_output") {
                 console.log(`DEBUG (handleServerEvent - Function Call Output Item Created):`, event.item);
            }
            break;
        case "conversation.item.updated":
            // console.log(`DEBUG (handleServerEvent - Item Updated):`, event.item);
            break;

        case "response.created":
            if (statusDiv) statusDiv.textContent = "Aiko sta pensando...";
            console.log("DEBUG: OpenAI response.created:", event.response.id);
            break;
        case "response.audio_transcript.delta": 
            if (typeof event.delta === 'string') {
                appendToTranscript("AI", event.delta, event.response.id); // Usa event.response.id per coerenza
            }
            if (statusDiv && !statusDiv.textContent.startsWith("Aiko risponde...")) {
                statusDiv.textContent = "Aiko risponde...";
            }
            break;
        case "response.done":
            console.log("DEBUG: OpenAI response.done:", event.response.id, "Output:", event.response.output);
            if (event.response.output && event.response.output[0]?.type === "function_call") {
                handleFunctionCall(event.response.output[0]);
            }
            // Lo stato "Aiko ha finito di parlare" è gestito da output_audio_buffer.stopped
            // o se non c'è audio, potrebbe essere necessario aggiornarlo qui.
            // Verifichiamo se la risposta non ha audio e se Aiko stava "pensando" o "rispondendo"
            const hasAudioOutput = event.response.output?.some(part => part.type === 'audio');
            if (!hasAudioOutput && (statusDiv.textContent.startsWith("Aiko sta pensando...") || statusDiv.textContent.startsWith("Aiko risponde..."))) {
                statusDiv.textContent = "Aiko ha finito."; // O "Pronto." se si preferisce.
            }
            break;
        case "error":
            console.error("Errore OpenAI Realtime:", JSON.stringify(event, null, 2));
            let errorMessage = "Errore OpenAI sconosciuto";
            let errorCode = "unknown_error";
            if (event.error) { 
                errorMessage = event.error.message || JSON.stringify(event.error);
                errorCode = event.error.code || errorCode;
            } else { 
                errorMessage = event.message || errorMessage;
                errorCode = event.code || errorCode;
            }
            if (statusDiv) statusDiv.textContent = `Errore OpenAI: ${errorMessage.substring(0, 60)}`;
            
            const criticalErrorCodes = ["session_expired", "token_expired", "session_not_found", 
                                      "connection_closed", "session_failed", "invalid_request_error",
                                      "authentication_error", "api_error", "invalid_api_key", "rate_limit_exceeded"];
            if (criticalErrorCodes.includes(errorCode) && !saveCurrentSessionHistoryAndStop.called) {
                if (statusDiv) statusDiv.textContent += " Sessione terminata o errore grave. Provo a salvare.";
                saveCurrentSessionHistoryAndStop();
            }
            break;
        
        // Eventi informativi
        case "input_audio_buffer.committed":
        case "rate_limits.updated":
        case "response.output_item.added":
        case "response.content_part.added":
        case "response.audio.done":
        case "response.audio_transcript.done":
        case "response.content_part.done":
        case "response.output_item.done":
        case "output_audio_buffer.started":
             // console.log(`DEBUG (handleServerEvent - Evento informativo): type='${event.type}'.`);
            break;
        case "output_audio_buffer.stopped":
            // console.log(`DEBUG (handleServerEvent - Evento informativo): type='${event.type}'.`);
            if (statusDiv && (statusDiv.textContent.startsWith("Aiko risponde...") || statusDiv.textContent.startsWith("Aiko ha finito di generare il testo."))) {
                statusDiv.textContent = "Aiko ha finito di parlare.";
            }
            break;

        default:
             console.log(`DEBUG (handleServerEvent - EVENTO SCONOSCIUTO O NON GESTITO): type='${event.type}'. obj:`, JSON.parse(JSON.stringify(event)));
            break;
    }
}

// --- Event Listeners UI ---
stopButton.addEventListener('click', () => {
    console.log("DEBUG: Pulsante TERMINA premuto.");
    if (statusDiv) statusDiv.textContent = "Chiusura conversazione e salvataggio...";
    if (!saveCurrentSessionHistoryAndStop.called) {
        saveCurrentSessionHistoryAndStop();
    }
});
startButton.addEventListener('click', startConversation);

window.addEventListener('beforeunload', (event) => {
    if (stopButton.disabled === false) { 
        console.log("DEBUG: Evento beforeunload, conversazione attiva.");
        // Non si possono fare operazioni asincrone affidabili qui.
        // La logica di salvataggio è principalmente legata al bottone stop o a errori/disconnessioni.
    }
});

// Inizializza lo stato dei pulsanti
stopConversation();
