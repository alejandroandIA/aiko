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
        let filename = 'audio.webm'; // Default, Whisper la supporta
        if (clientContentType.includes('mp4') || clientContentType.includes('m4a')) filename = 'audio.m4a';
        else if (clientContentType.includes('mpeg') || clientContentType.includes('mp3')) filename = 'audio.mp3';
        else if (clientContentType.includes('wav')) filename = 'audio.wav';
        else if (clientContentType.includes('ogg')) filename = 'audio.ogg';
        // Aggiungi altri formati se necessario, webm è un buon default
        console.log(`DEBUG api/transcribeAudio: Content-Type client: ${clientContentType}, Filename per Whisper: ${filename}`);

        const form = new FormData();
        form.append('file', audioBuffer, {
            filename: filename,
            contentType: clientContentType,
        });
        form.append('model', 'whisper-1');
        // NON specificare 'language' per la rilevazione automatica
        // form.append('response_format', 'verbose_json'); // Utile per ottenere la lingua rilevata

        console.log(`DEBUG api/transcribeAudio: FormData preparato. Invio a OpenAI Whisper API per trascrizione con rilevamento automatico lingua...`);

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                ...form.getHeaders(),
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: form,
        });

        const responseBodyText = await whisperResponse.text();

        if (!whisperResponse.ok) {
            console.error(`Errore dall'API Whisper: ${whisperResponse.status} ${whisperResponse.statusText}`);
            console.error("Dettagli errore Whisper:", responseBodyText);
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

        // Se vuoi vedere la lingua rilevata (richiede response_format: 'verbose_json')
        // if (whisperData.language) {
        //     console.log(`DEBUG api/transcribeAudio: Lingua rilevata da Whisper: ${whisperData.language}`);
        // }
        console.log("DEBUG api/transcribeAudio: Trascrizione ricevuta da Whisper:", whisperData.text);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: whisperData.text /*, detected_language: whisperData.language (se usi verbose_json) */ });

    } catch (error) {
        console.error("Errore generico nella serverless function api/transcribeAudio.js:", error);
        const errorMessage = error.message || "Errore sconosciuto durante l'elaborazione della richiesta.";
        const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione audio.", details: errorMessage, stack: errorStack });
    }
}
