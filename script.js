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
const SUMMARY_API_ENDPOINT = "/api/generateContextSummary"; // Nuovo

let pc;
let dc;
let localStream;
let currentAIResponseId = null;
let currentConversationHistory = [];

async function getContextSummary() {
    console.log("DEBUG: Richiesta riassunto del contesto...");
    statusDiv.textContent = "Recupero contesto precedente...";
    try {
        const response = await fetch(SUMMARY_API_ENDPOINT);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(`Errore dal backend per il riassunto (${response.status}):`, errorData.error || 'Errore sconosciuto');
            return "";
        }
        const data = await response.json();
        console.log("DEBUG: Riassunto del contesto ricevuto (o messaggio se vuoto):", data.summary);
        return data.summary || "";
    } catch (error) {
        console.warn("Errore durante il recupero del riassunto del contesto:", error);
        return "";
    }
}

async function getEphemeralToken(contextSummary) {
    statusDiv.textContent = "Richiesta token di sessione...";
    try {
        const response = await fetch(SESSION_API_ENDPOINT, {
            method: 'POST', // Cambiato a POST
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ contextSummary: contextSummary })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Errore dal backend per il token (${response.status}): ${errorData.error || 'Errore sconosciuto'}`);
        }
        const data = await response.json();
        if (!data.client_secret) {
             throw new Error('Token non ricevuto dal backend.');
        }
        return data.client_secret;
    } catch (error) {
        console.error("Errore durante il recupero del token effimero:", error);
        statusDiv.textContent = `Errore token: ${error.message}`;
        throw error;
    }
}

async function startConversation() {
    startButton.disabled = true;
    stopButton.disabled = false;
    transcriptsDiv.innerHTML = "";
    currentAIResponseId = null;
    currentConversationHistory = [];
    console.log("DEBUG: Nuova conversazione iniziata, currentConversationHistory resettato.");

    try {
        const summary = await getContextSummary(); // Ottieni prima il riassunto
        statusDiv.textContent = "Riassunto ottenuto, richiedo sessione...";

        const ephemeralKey = await getEphemeralToken(summary); // Passa il riassunto
        if (!ephemeralKey) {
            stopConversation();
            return;
        }

        pc = new RTCPeerConnection();

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => console.warn("AI Audio play GIA' IN CORSO o INTERROTTO:", e));
            }
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            statusDiv.textContent = "Microfono attivato.";
        } catch (err) {
            console.error("Errore accesso al microfono:", err);
            statusDiv.textContent = "Errore accesso microfono. Controlla permessi.";
            stopConversation();
            return;
        }

        dc = pc.createDataChannel("oai-events", { ordered: true });
        dc.onopen = () => {
            statusDiv.textContent = "Connesso. In attesa...";
            sendClientEvent({ // Le istruzioni ora sono gestite principalmente in api/session.js
                type: "session.update",
                session: {
                    // Le istruzioni dettagliate sono ora in api/session.js, qui possiamo inviare solo aggiornamenti se necessario
                    // o configurare i tools se non sono già nella sessione base
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5,
                        silence_duration_ms: 800,
                        create_response: true,
                    },
                    tools: [{
                        type: "function",
                        name: "cerca_nella_mia_memoria_personale",
                        description: "Cerca nelle conversazioni passate dell'utente Alejandro per trovare informazioni specifiche, dettagli personali, preferenze o rispondere a domande su eventi precedenti.",
                        parameters: {
                            type: "object",
                            properties: {
                                termini_di_ricerca: {
                                    type: "string",
                                    description: "Le parole chiave o la domanda specifica da cercare nella cronologia delle conversazioni passate con Alejandro."
                                }
                            },
                            required: ["termini_di_ricerca"]
                        }
                    }]
                }
            });
        };
        dc.onmessage = (event) => {
            try {
                handleServerEvent(JSON.parse(event.data));
            } catch (e) {
                console.error("Errore parsing messaggio server:", e, "Dati:", event.data);
            }
        };
        dc.onclose = () => console.log("DEBUG: Data channel chiuso.");
        dc.onerror = (error) => {
            console.error("Errore Data channel:", error);
            statusDiv.textContent = "Errore Data channel.";
        };

        pc.onicecandidate = (event) => {};

        pc.onconnectionstatechange = () => {
            console.log(`DEBUG: Stato connessione WebRTC: ${pc.connectionState}`);
            if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
                statusDiv.textContent = `Connessione WebRTC: ${pc.connectionState}. Prova a riavviare.`;
                if (pc.connectionState !== "closed") {
                    console.log("DEBUG: Connessione WebRTC persa, tento salvataggio e stop.");
                    saveCurrentSessionHistoryAndStop();
                }
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        statusDiv.textContent = "Offerta SDP creata. Connessione a OpenAI...";

        const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL_NAME}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                "Authorization": `Bearer ${ephemeralKey}`,
                "Content-Type": "application/sdp"
            },
        });

        if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text();
            throw new Error(`Errore SDP OpenAI (${sdpResponse.status}): ${errorText}`);
        }
        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    } catch (error) {
        console.error("Errore durante l'avvio della conversazione:", error);
        statusDiv.textContent = `Errore avvio: ${error.message}`;
        stopConversation();
    }
}

async function saveCurrentSessionHistoryAndStop() {
    console.log("DEBUG (saveCurrentSessionHistoryAndStop): Funzione CHIAMATA!");
    console.log("DEBUG (saveCurrentSessionHistoryAndStop): Contenuto di currentConversationHistory PRIMA del salvataggio:", JSON.stringify(currentConversationHistory, null, 2));

    if (currentConversationHistory.length > 0) {
        statusDiv.textContent = "Salvataggio conversazione...";
        let entriesSavedCount = 0;
        for (const entry of currentConversationHistory) {
            const isValidForSaving = entry &&
                                     typeof entry.speaker === 'string' && entry.speaker.trim() !== '' &&
                                     typeof entry.content === 'string' && entry.content.trim() !== '';
            if (!isValidForSaving) {
                console.warn("DEBUG (saveCurrentSessionHistoryAndStop - SALTO ENTRY):", entry);
                continue;
            }
            try {
                const requestBody = { speaker: entry.speaker, content: entry.content };
                const saveResponse = await fetch(SAVE_MEMORY_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                if (!saveResponse.ok) {
                    const errorData = await saveResponse.json().catch(() => ({}));
                    console.error(`DEBUG (saveCurrentSessionHistoryAndStop): Errore server saveToMemory (${saveResponse.status}):`, errorData, "Per entry:", entry);
                } else {
                    entriesSavedCount++;
                    const responseData = await saveResponse.json();
                    console.log(`DEBUG (saveCurrentSessionHistoryAndStop): Entry salvata. Server:`, responseData.message);
                }
            } catch (saveError) {
                console.error("DEBUG (saveCurrentSessionHistoryAndStop): Errore fetch salvataggio:", saveError, "Per entry:", entry);
            }
        }
        console.log(`DEBUG (saveCurrentSessionHistoryAndStop): ${entriesSavedCount} entries inviate.`);
        currentConversationHistory = [];
    } else {
        console.log("DEBUG (saveCurrentSessionHistoryAndStop): History vuota, nessun salvataggio.");
    }
    statusDiv.textContent = "Salvataggio completato (o non necessario).";
    stopConversation();
}

function stopConversation() {
    console.log("DEBUG (stopConversation): Funzione CHIAMATA!");
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
    statusDiv.textContent = "Conversazione terminata.";
    if (aiAudioPlayer) aiAudioPlayer.srcObject = null;
    currentAIResponseId = null;
}

function sendClientEvent(event) {
    if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify(event));
    }
}

function addTranscript(speaker, textContent, itemId) {
    console.log(`DEBUG (addTranscript - ENTRATA): Speaker='${speaker}', Content='${textContent}', itemId='${itemId}'`);
    const id = `${speaker}-${itemId || 'general'}`;
    let transcriptDiv = document.getElementById(id);
    if (!transcriptDiv) {
        transcriptDiv = document.createElement('div');
        transcriptDiv.id = id;
        transcriptDiv.className = speaker.toLowerCase();
        transcriptsDiv.appendChild(transcriptDiv);
    }
    transcriptDiv.textContent = `${speaker}: ${textContent}`;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    if ((speaker === "Tu" || speaker === "AI") && typeof textContent === 'string' && textContent.trim() !== '') {
        console.log(`DEBUG (addTranscript - AGGIUNGO A HISTORY): Speaker: ${speaker}, Content: "${textContent}"`);
        currentConversationHistory.push({ speaker, content: textContent });
    } else {
        console.warn(`DEBUG (addTranscript - SALTO HISTORY): Speaker: ${speaker}, Content='${textContent}'`);
    }
}

function appendToTranscript(speaker, textDelta, itemId) {
    const id = `${speaker}-${itemId || 'general'}`;
    let transcriptDiv = document.getElementById(id);
    let isNewVisualEntry = false;
    if (!transcriptDiv) {
        transcriptDiv = document.createElement('div');
        transcriptDiv.id = id;
        transcriptDiv.className = speaker.toLowerCase();
        transcriptDiv.textContent = `${speaker}: `;
        transcriptsDiv.appendChild(transcriptDiv);
        isNewVisualEntry = true;
    }
    transcriptDiv.textContent += textDelta;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    if (speaker === "AI") {
        const lastEntryInHistory = currentConversationHistory.length > 0 ? currentConversationHistory[currentConversationHistory.length - 1] : null;
        if (isNewVisualEntry || !lastEntryInHistory || lastEntryInHistory.speaker !== "AI") {
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                currentConversationHistory.push({ speaker: "AI", content: textDelta });
            }
        } else if (lastEntryInHistory && lastEntryInHistory.speaker === "AI") {
            if (typeof textDelta === 'string' && textDelta.trim() !== '') {
                lastEntryInHistory.content += textDelta;
            }
        }
    }
}

async function handleFunctionCall(functionCall) {
    if (functionCall.name === "cerca_nella_mia_memoria_personale") {
        statusDiv.textContent = "Ok, fammi cercare nei miei ricordi...";
        console.log("DEBUG (handleFunctionCall): Chiamo cerca_nella_mia_memoria_personale. Args:", functionCall.arguments);
        try {
            const args = JSON.parse(functionCall.arguments);
            const searchQuery = args.termini_di_ricerca;
            addTranscript("Sistema", `Sto cercando nei ricordi: "${searchQuery}"...`, `search-${functionCall.call_id}`);
            const searchResponse = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?query=${encodeURIComponent(searchQuery)}`);
            if (!searchResponse.ok) {
                const errorData = await searchResponse.json().catch(() => ({}));
                addTranscript("Sistema", `Errore ricerca: ${errorData.error || searchResponse.status}`, `search-err-${functionCall.call_id}`);
                throw new Error(`Errore server ricerca: ${searchResponse.status}`);
            }
            const searchData = await searchResponse.json();
            const functionOutput = JSON.stringify({ results: searchData.results || "Nessun ricordo trovato." });
            addTranscript("Sistema", `Risultato ricerca: ${searchData.results.substring(0,100)}...`, `search-res-${functionCall.call_id}`);
            sendClientEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: functionCall.call_id, output: functionOutput } });
            sendClientEvent({ type: "response.create" });
            statusDiv.textContent = "Ho cercato. Formulo risposta...";
        } catch (e) {
            console.error("DEBUG (handleFunctionCall): Errore:", e);
            addTranscript("Sistema", `Errore ricerca (catch): ${e.message}`, `search-catch-${functionCall.call_id}`);
            sendClientEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: functionCall.call_id, output: JSON.stringify({ error: "Non sono riuscito a cercare." }) } });
            sendClientEvent({ type: "response.create" });
            statusDiv.textContent = "Errore ricerca memoria.";
        }
    }
}

function handleServerEvent(event) {
    console.log(`DEBUG (handleServerEvent): Ricevuto evento: type='${event.type}', obj:`, JSON.parse(JSON.stringify(event)));

    switch (event.type) {
        case "session.created":
            statusDiv.textContent = `Sessione ${event.session.id.slice(-4)} creata.`;
            break;
        case "session.updated": break;
        case "input_audio_buffer.speech_started": statusDiv.textContent = "Ti ascolto..."; break;
        case "input_audio_buffer.speech_stopped": statusDiv.textContent = "Elaboro audio..."; break;

        case "conversation.item.created":
            if (event.item && event.item.role === "user" && event.item.type === "message") {
                const userTranscript = event.item.content;
                if (userTranscript && typeof userTranscript === 'string' && userTranscript.trim() !== '') {
                    console.log(`DEBUG (handleServerEvent - USER MESSAGE): TROVATA TRASCRIZIONE! Transcript='${userTranscript}'`);
                    addTranscript("Tu", userTranscript, event.item.id);
                } else {
                    console.warn(`DEBUG (handleServerEvent - USER MESSAGE): Transcript vuoto o non stringa. Item:`, event.item);
                }
            }
            break;

        case "conversation.item.input_audio_transcription.completed": // Fallback, ma non dovrebbe servire
            console.log(`DEBUG (handleServerEvent - transcription.completed - OBSOLETO?): transcript='${event.transcript}'`);
            if (event.transcript && typeof event.transcript === 'string' && event.transcript.trim() !== '') {
                addTranscript("Tu", event.transcript, event.item_id);
            }
            break;

        case "response.created":
            currentAIResponseId = event.response.id;
            statusDiv.textContent = "AI elabora...";
            break;
        case "response.text.delta":
        case "response.audio_transcript.delta":
            if (typeof event.delta === 'string') {
                appendToTranscript("AI", event.delta, event.response_id || currentAIResponseId);
                statusDiv.textContent = "AI risponde...";
            }
            break;
        case "response.done":
            if (event.response.output && event.response.output.length > 0 && event.response.output[0].type === "function_call") {
                handleFunctionCall(event.response.output[0]);
            } else {
                statusDiv.textContent = "Risposta AI completata.";
            }
            currentAIResponseId = null;
            break;
        case "error":
            console.error("Errore OpenAI:", event);
            statusDiv.textContent = `Errore OpenAI: ${event.message || event.code}`;
            if (["session_expired", "token_expired", "session_not_found", "connection_closed"].includes(event.code)) {
                saveCurrentSessionHistoryAndStop();
            }
            break;
        default:
             console.log(`DEBUG (handleServerEvent - EVENTO NON GESTITO): type='${event.type}'. Evento:`, JSON.parse(JSON.stringify(event)));
            break;
    }
}

stopButton.addEventListener('click', () => saveCurrentSessionHistoryAndStop());
startButton.addEventListener('click', startConversation);
window.addEventListener('beforeunload', () => {
    if (pc && pc.connectionState !== "closed") stopConversation();
});
