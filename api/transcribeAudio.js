// api/transcribeAudio.js
import FormData from 'form-data';
import fetch from 'node-fetch';

export const config = {
    api: {
        bodyParser: false,
    },
};

async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => {
            console.error('Errore durante la lettura del flusso della richiesta:', err);
            reject(new Error('Errore lettura stream audio'));
        });
    });
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed, use POST.` });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.error('ERRORE FATALE in api/transcribeAudio: OPENAI_API_KEY non configurata.');
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    try {
        console.log("DEBUG api/transcribeAudio: Inizio gestione richiesta POST.");
        const audioBuffer = await getRawBody(req);

        if (!audioBuffer || audioBuffer.length === 0) {
            console.warn('api/transcribeAudio: Ricevuto corpo audio vuoto o non valido.');
            return res.status(400).json({ error: 'Corpo audio vuoto o non valido.' });
        }
        console.log(`DEBUG api/transcribeAudio: Audio buffer ricevuto, lunghezza: ${audioBuffer.length}`);

        const clientContentType = req.headers['content-type'] || 'audio/webm';
        let filename = 'audio.webm'; // Default se nessun altro match

        // Logica filename aggiornata
        if (clientContentType.includes('mp4')) { // Se il client invia audio/mp4
            filename = 'audio.mp4'; // Usa .mp4 come estensione per Whisper
        } else if (clientContentType.includes('m4a')) { // Per file esplicitamente m4a
            filename = 'audio.m4a';
        } else if (clientContentType.includes('mpeg') || clientContentType.includes('mp3')) {
            filename = 'audio.mp3';
        } else if (clientContentType.includes('wav')) {
            filename = 'audio.wav';
        } else if (clientContentType.includes('ogg')) { // oga è spesso usato per ogg vorbis
            filename = 'audio.ogg';
        } else if (clientContentType.includes('webm')) { // Assicurati che webm sia gestito
             filename = 'audio.webm';
        }
        // Se hai altri formati specifici che MediaRecorder potrebbe produrre, aggiungili.

        console.log(`DEBUG api/transcribeAudio: Content-Type client: ${clientContentType}, Filename per Whisper: ${filename}`);

        const form = new FormData();
        form.append('file', audioBuffer, {
            filename: filename, // Nome file corretto
            contentType: clientContentType, // Questo è più per informazione, Whisper si basa sull'estensione
        });
        form.append('model', 'whisper-1');
        // NON specificare 'language' per la rilevazione automatica
        // form.append('response_format', 'verbose_json'); // Utile per ottenere la lingua rilevata

        console.log(`DEBUG api/transcribeAudio: FormData preparato. Invio a OpenAI Whisper API...`);

        const WHISPER_API_TIMEOUT_MS = 50000; // 50 secondi di timeout

        const fetchPromise = fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                ...form.getHeaders(),
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: form,
        });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout API Whisper dopo ' + (WHISPER_API_TIMEOUT_MS / 1000) + ' secondi')), WHISPER_API_TIMEOUT_MS)
        );

        let whisperResponse;
        try {
            whisperResponse = await Promise.race([fetchPromise, timeoutPromise]);
            if (whisperResponse instanceof Error) { // Se è l'errore di timeout da timeoutPromise
                throw whisperResponse; // Rilancia l'errore di timeout
            }
        } catch (error) {
            if (error.message && error.message.startsWith('Timeout API Whisper')) {
                console.error(`Errore di Timeout Interno: ${error.message}`);
                return res.status(408).json({ error: "La trascrizione dell'audio ha impiegato troppo tempo (timeout).", details: error.message });
            }
            // Altri errori di rete o fetch
            console.error("Errore durante la chiamata fetch a Whisper:", error);
            return res.status(500).json({ error: "Errore di rete durante la comunicazione con l'API Whisper.", details: error.message });
        }

        const responseBodyText = await whisperResponse.text();

        if (!whisperResponse.ok) {
            console.error(`Errore dall'API Whisper: ${whisperResponse.status} ${whisperResponse.statusText}`);
            console.error("Dettagli errore Whisper:", responseBodyText); // Questo mostrerà l'errore di formato
            let errorDetails = `Errore API Whisper (${whisperResponse.status})`;
            try {
                const errorData = JSON.parse(responseBodyText);
                errorDetails = errorData.error?.message || JSON.stringify(errorData.error) || responseBodyText;
            } catch (e) { /* usa responseBodyText se non è JSON */ }
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione audio con OpenAI Whisper.", details: errorDetails });
        }

        const whisperData = JSON.parse(responseBodyText);

        if (typeof whisperData.text !== 'string') {
            console.error("Risposta da Whisper non contiene il campo 'text' atteso:", whisperData);
            return res.status(500).json({ error: "Formato risposta trascrizione inatteso da OpenAI." });
        }
        
        console.log("DEBUG api/transcribeAudio: Trascrizione ricevuta da Whisper:", whisperData.text);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: whisperData.text });

    } catch (error) {
        console.error("Errore generico nella serverless function api/transcribeAudio.js:", error);
        const errorMessage = error.message || "Errore sconosciuto durante l'elaborazione della richiesta.";
        const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione audio.", details: errorMessage, stack: errorStack });
    }
}
