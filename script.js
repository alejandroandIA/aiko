const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptsDiv = document.getElementById('transcripts');
const aiAudioPlayer = document.getElementById('aiAudioPlayer');

const MODEL_NAME = "gpt-4o-realtime-preview-2024-10-01";
const BACKEND_API_ENDPOINT = "/api/session";

let pc;
let dc;
let localStream;
let currentAIResponseId = null; 

async function getEphemeralToken() {
    statusDiv.textContent = "Richiesta token di sessione...";
    try {
        const response = await fetch(BACKEND_API_ENDPOINT); 
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
                    instructions: "Sei un assistente AI amichevole, empatico e conciso. Rispondi sempre in italiano e cerca di avere un tono di voce naturale e umano.",
                    turn_detection: {
                        type: "semantic_vad",
                        eagerness: "low",
                        create_response: true, 
                        interrupt_response: true 
                    }
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
                if (pc.connectionState !== "closed") stopConversation(); 
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
            appendToTranscript("AI", "", currentAIResponseId); 
            statusDiv.textContent = "AI sta rispondendo...";
            break;
        case "response.text.delta":
            if (event.delta) {
                appendToTranscript("AI", event.delta, event.response_id || currentAIResponseId);
            }
            break;
        case "response.done":
            statusDiv.textContent = "Risposta AI completata. Parla pure!";
            currentAIResponseId = null;
            break;
        case "error":
            console.error("Errore dal server OpenAI:", event);
            statusDiv.textContent = `Errore OpenAI: ${event.message || event.code || 'Errore sconosciuto'}`;
            if (event.code === "session_expired" || event.code === "token_expired" || event.code === "session_not_found") {
                stopConversation();
            }
            break;
        default:
            break;
    }
}

startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);

window.addEventListener('beforeunload', () => {
    if (pc && pc.connectionState !== "closed") {
        stopConversation();
    }
});
