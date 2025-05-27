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
        const audioBlobBuffer = await getReqBodyBuffer(req); // Usa la funzione helper

        if (!audioBlobBuffer || audioBlobBuffer.length === 0) {
            return res.status(400).json({ error: "Nessun dato audio ricevuto." });
        }

        const formData = new FormData();
        // Determina il contentType dal client o usa un default ragionevole
        const contentType = req.headers['content-type'] || 'audio/webm';
        formData.append('file', audioBlobBuffer, { filename: 'audio.webm', contentType: contentType });
        formData.append('model', 'whisper-1');
        formData.append('language', 'it');

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData,
        });

        if (!whisperResponse.ok) {
            let errorDetails = "Dettagli non disponibili";
            try {
                const errorData = await whisperResponse.json();
                errorDetails = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
                errorDetails = await whisperResponse.text();
            }
            console.error("Errore API Whisper:", whisperResponse.status, errorDetails);
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione.", details: errorDetails });
        }

        const transcriptionData = await whisperResponse.json();
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: transcriptionData.text });

    } catch (error) {
        console.error("Errore generico in transcribeAudio:", error);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione.", details: error.message });
    }
}
