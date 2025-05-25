const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptsDiv = document.getElementById('transcripts');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

const MODEL_NAME = "gpt-4o-realtime-preview-2024-12-17"; // O gpt-4o-search-preview se vuoi testarlo
const SESSION_API_ENDPOINT = "/api/session";
const SAVE_MEMORY_API_ENDPOINT = "/api/saveToMemory";
const SEARCH_MEMORY_API_ENDPOINT = "/api/searchMemory";

let pc;
let dc;
let localStream;
let currentAIResponseId = null;
let currentConversationHistory = []; // Per tenere traccia della sessione corrente

async function getEphemeralToken() {
    statusDiv.textContent = "Richiesta token di sessione...";
    try {
        const response = await fetch(SESSION_API_ENDPOINT); 
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Errore dal backend (${response.status}): ${errorData.error || 'Errore sconosciuto'}`);
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
    statusDiv.textContent = "Avvio conversazione...";
    transcriptsDiv.innerHTML = ""; 
    currentAIResponseId = null;
    currentConversationHistory = []; // Resetta la cronologia della sessione

    try {
        const ephemeralKey = await getEphemeralToken();
        if (!ephemeralKey) {
            stopConversation(); 
            return;
        }

        pc = new RTCPeerConnection();

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                aiAudioPlayer.srcObject = event.streams[0];
                aiAudioPlayer.play().catch(e => {});
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
            sendClientEvent({
                type: "session.update",
                session: {
                    instructions: "Sei un assistente AI amichevole e conciso. Rispondi in italiano. Puoi cercare nelle conversazioni passate se ti viene chiesto di ricordare qualcosa, usando lo strumento 'cerca_nella_mia_memoria_personale'.",
                    // Torniamo a server_vad per stabilità mentre implementiamo la memoria
                    turn_detection: {
                        type: "server_vad", 
                        threshold: 0.5,
                        silence_duration_ms: 800,
                        create_response: true, 
                    },
                    tools: [{ // Definizione dello strumento di ricerca memoria
                        type: "function",
                        function: {
                            name: "cerca_nella_mia_memoria_personale",
                            description: "Cerca nelle conversazioni passate dell'utente per trovare informazioni specifiche o rispondere a domande su eventi precedenti.",
                            parameters: {
                                type: "object",
                                properties: {
                                    termini_di_ricerca: {
                                        type: "string",
                                        description: "Le parole chiave o la domanda specifica da cercare nella cronologia delle conversazioni passate."
                                    }
                                },
                                required: ["termini_di_ricerca"]
                            }
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
        dc.onclose = () => {};
        dc.onerror = (error) => {
            console.error("Errore Data channel:", error);
            statusDiv.textContent = "Errore Data channel.";
        };

        pc.onicecandidate = (event) => {};

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
                statusDiv.textContent = `Connessione WebRTC: ${pc.connectionState}. Prova a riavviare.`;
                if (pc.connectionState !== "closed") saveCurrentSessionHistoryAndStop();
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
    if (currentConversationHistory.length > 0) {
        statusDiv.textContent = "Salvataggio conversazione...";
        for (const entry of currentConversationHistory) {
            try {
                await fetch(SAVE_MEMORY_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ speaker: entry.speaker, content: entry.text })
                });
            } catch (saveError) {
                console.error("Errore durante il salvataggio di un messaggio:", saveError);
                // Continua anche se un messaggio non viene salvato
            }
        }
        currentConversationHistory = []; // Pulisci dopo il salvataggio
        statusDiv.textContent = "Conversazione salvata.";
    }
    stopConversation();
}


function stopConversation() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (dc && dc.readyState !== "closed") {
        dc.close();
    }
    dc = null;
    if (pc && pc.connectionState !== "closed") {
        pc.close();
    }
    pc = null;
    
    startButton.disabled = false;
    stopButton.disabled = true;
    statusDiv.textContent = "Conversazione terminata. Pronto per iniziare una nuova.";
    if (aiAudioPlayer) aiAudioPlayer.srcObject = null;
    currentAIResponseId = null;
}

function sendClientEvent(event) {
    if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify(event));
    }
}

function addTranscript(speaker, text, itemId) {
    const id = `${speaker}-${itemId || 'general'}`;
    let transcriptDiv = document.getElementById(id);
    if (!transcriptDiv) {
        transcriptDiv = document.createElement('div');
        transcriptDiv.id = id;
        transcriptDiv.className = speaker.toLowerCase();
        transcriptsDiv.appendChild(transcriptDiv);
    }
    transcriptDiv.textContent = `${speaker}: ${text}`;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight; 

    if (speaker === "Tu" || speaker === "AI") { // Salva solo i dialoghi utente/AI effettivi
        currentConversationHistory.push({ speaker, text });
    }
}

function appendToTranscript(speaker, textDelta, itemId) {
    const id = `${speaker}-${itemId || 'general'}`;
    let transcriptDiv = document.getElementById(id);
    if (!transcriptDiv) {
        transcriptDiv = document.createElement('div');
        transcriptDiv.id = id;
        transcriptDiv.className = speaker.toLowerCase();
        transcriptDiv.textContent = `${speaker}: `;
        transcriptsDiv.appendChild(transcriptDiv);
    }
    transcriptDiv.textContent += textDelta;
    transcriptsDiv.scrollTop = transcriptsDiv.scrollHeight;

    // Aggiorna l'ultimo messaggio nella cronologia se è un delta per l'AI
    if (speaker === "AI" && currentConversationHistory.length > 0) {
        const lastEntry = currentConversationHistory[currentConversationHistory.length - 1];
        if (lastEntry.speaker === "AI" && transcriptDiv.textContent.startsWith(`${speaker}: `)) {
            lastEntry.text = transcriptDiv.textContent.substring(`${speaker}: `.length);
        } else if (lastEntry.speaker !== "AI") { // Inizia un nuovo messaggio AI
             currentConversationHistory.push({ speaker: "AI", text: textDelta });
        }
    }
}

async function handleFunctionCall(functionCall) {
    if (functionCall.name === "cerca_nella_mia_memoria_personale") {
        statusDiv.textContent = "Ok, fammi cercare nei miei ricordi...";
        try {
            const args = JSON.parse(functionCall.arguments);
            const searchQuery = args.termini_di_ricerca;

            const searchResponse = await fetch(`${SEARCH_MEMORY_API_ENDPOINT}?query=${encodeURIComponent(searchQuery)}`);
            if (!searchResponse.ok) {
                throw new Error(`Errore dal server di ricerca memoria: ${searchResponse.status}`);
            }
            const searchData = await searchResponse.json();
            
            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: functionCall.call_id,
                    output: JSON.stringify({ results: searchData.results || "Non ho trovato nulla per quei termini." })
                }
            });
            // Chiedi all'AI di rispondere basandosi sui risultati
            sendClientEvent({ type: "response.create" });
            statusDiv.textContent = "Ho cercato. Ora formulo una risposta...";

        } catch (e) {
            console.error("Errore durante la chiamata di funzione searchMemory:", e);
            // Invia un output di errore all'AI
            sendClientEvent({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: functionCall.call_id,
                    output: JSON.stringify({ error: "Non sono riuscito a cercare nella memoria in questo momento." })
                }
            });
            sendClientEvent({ type: "response.create" });
            statusDiv.textContent = "Errore nella ricerca memoria. Provo a rispondere comunque.";
        }
    }
}


function handleServerEvent(event) {
    switch (event.type) {
        case "session.created":
            statusDiv.textContent = `Sessione ${event.session.id.slice(-4)} creata. Parla pure!`;
            break;
        case "session.updated":
            break;
        case "input_audio_buffer.speech_started":
            statusDiv.textContent = "Ti sto ascoltando...";
            break;
        case "input_audio_buffer.speech_stopped":
            statusDiv.textContent = "Elaborazione audio... Attendo risposta AI...";
            break;
        case "conversation.item.input_audio_transcription.completed":
            if (event.transcript) {
                addTranscript("Tu", event.transcript, event.item_id);
            }
            break;
        case "response.created":
            currentAIResponseId = event.response.id;
            if (event.response.output && event.response.output.length > 0 && event.response.output[0].type === "function_call") {
                // Non creare subito il div per la risposta AI se è una function call
            } else {
                appendToTranscript("AI", "", currentAIResponseId); 
            }
            statusDiv.textContent = "AI sta elaborando..."; // Modificato da "AI sta rispondendo"
            break;
        case "response.text.delta":
            if (event.delta) {
                appendToTranscript("AI", event.delta, event.response_id || currentAIResponseId);
                 statusDiv.textContent = "AI sta rispondendo...";
            }
            break;
        case "response.done":
            // Controlla se l'output è una function call
            if (event.response.output && event.response.output.length > 0 && event.response.output[0].type === "function_call") {
                const functionCall = event.response.output[0];
                handleFunctionCall(functionCall);
            } else {
                statusDiv.textContent = "Risposta AI completata. Parla pure!";
                 // Assicura che l'ultimo messaggio AI sia completo nella cronologia
                if (currentConversationHistory.length > 0 && currentConversationHistory[currentConversationHistory.length-1].speaker === "AI") {
                    // L'aggiornamento con delta dovrebbe aver già completato il testo.
                    // Se necessario, qui si potrebbe prendere il testo finale da event.response.output
                }
            }
            currentAIResponseId = null;
            break;
        case "error":
            console.error("Errore dal server OpenAI:", event);
            statusDiv.textContent = `Errore OpenAI: ${event.message || event.code || 'Errore sconosciuto'}`;
            if (event.code === "session_expired" || event.code === "token_expired" || event.code === "session_not_found") {
                saveCurrentSessionHistoryAndStop();
            }
            break;
        default:
            break;
    }
}

// Modificato l'event listener per il pulsante stop
stopButton.addEventListener('click', saveCurrentSessionHistoryAndStop); 
startButton.addEventListener('click', startConversation);

window.addEventListener('beforeunload', () => {
    // Considera se salvare anche qui, ma potrebbe essere troppo frequente o incompleto
    if (pc && pc.connectionState !== "closed") {
        // saveCurrentSessionHistoryAndStop(); // Potrebbe essere troppo aggressivo
        stopConversation(); // Chiude solo la connessione
    }
});
