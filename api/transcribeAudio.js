// api/transcribeAudio.js
import FormData from 'form-data';

// Funzione helper per leggere il corpo della richiesta come buffer
async function getReqBodyBuffer(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end('Method Not Allowed');
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.error("transcribeAudio: OPENAI_API_KEY mancante.");
        return res.status(500).json({ error: "Configurazione API mancante." });
    }

    try {
        const audioBlobBuffer = await getReqBodyBuffer(req);
        const clientContentType = req.headers['content-type'] || 'audio/webm';
        
        console.log(`DEBUG transcribeAudio: Ricevuto buffer audio, lunghezza: ${audioBlobBuffer.length}, Content-Type dal client: ${clientContentType}`);

        if (!audioBlobBuffer || audioBlobBuffer.length === 0) {
            return res.status(400).json({ error: "Nessun dato audio ricevuto." });
        }
         if (audioBlobBuffer.length < 200) { // Whisper potrebbe rifiutare file troppo piccoli
            console.warn("transcribeAudio: File audio molto piccolo, potrebbe essere rifiutato. Lunghezza:", audioBlobBuffer.length);
        }

        const formData = new FormData();
        let filename = 'audio.unknown';
        if (clientContentType.includes('webm')) filename = 'audio.webm';
        else if (clientContentType.includes('mp4')) filename = 'audio.mp4';
        else if (clientContentType.includes('mp3')) filename = 'audio.mp3';
        else if (clientContentType.includes('mpeg')) filename = 'audio.mpeg';
        else if (clientContentType.includes('wav')) filename = 'audio.wav';
        else if (clientContentType.includes('ogg')) filename = 'audio.ogg';

        formData.append('file', audioBlobBuffer, {
            filename: filename,
            contentType: clientContentType,
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'it');
        formData.append('response_format', 'json');

        console.log(`DEBUG transcribeAudio: Invio a Whisper con filename: ${filename}, effective contentType: ${clientContentType}`);

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        const responseBodyText = await whisperResponse.text();
        console.log("DEBUG transcribeAudio: Risposta grezza da Whisper:", responseBodyText);

        if (!whisperResponse.ok) {
            let errorDetails = `Errore ${whisperResponse.status} da Whisper: ${responseBodyText}`;
            try {
                const errorData = JSON.parse(responseBodyText);
                errorDetails = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) { /* errorDetails già contiene il testo grezzo */ }
            console.error("Errore API Whisper:", whisperResponse.status, errorDetails);
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione.", details: errorDetails });
        }

        const transcriptionData = JSON.parse(responseBodyText);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: transcriptionData.text });

    } catch (error) {
        console.error("Errore generico in transcribeAudio:", error.message, error.stack);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione.", details: error.message });
    }
}
