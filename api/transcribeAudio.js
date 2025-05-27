// api/transcribeAudio.js
import FormData from 'form-data';

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
        const clientContentType = req.headers['content-type']; // Prendiamo il content type inviato dal client
        console.log(`DEBUG transcribeAudio: Ricevuto buffer audio, lunghezza: ${audioBlobBuffer.length}, Content-Type dal client: ${clientContentType}`);


        if (!audioBlobBuffer || audioBlobBuffer.length === 0) {
            return res.status(400).json({ error: "Nessun dato audio ricevuto." });
        }
        if (audioBlobBuffer.length < 1000) { // Whisper potrebbe rifiutare file troppo piccoli
            console.warn("transcribeAudio: File audio molto piccolo, potrebbe essere rifiutato da Whisper.");
        }

        const formData = new FormData();
        // Usiamo un nome file con estensione che corrisponda al contentType se possibile
        let filename = 'audio.webm'; // Default
        if (clientContentType && clientContentType.includes('mp4')) {
            filename = 'audio.mp4';
        } else if (clientContentType && clientContentType.includes('mpeg')) { // per mp3
            filename = 'audio.mp3';
        } else if (clientContentType && clientContentType.includes('wav')) {
            filename = 'audio.wav';
        }
        // Aggiungi altri formati supportati da Whisper se necessario

        formData.append('file', audioBlobBuffer, { filename: filename, contentType: clientContentType || 'audio/webm' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'it');
        formData.append('response_format', 'json'); // Assicura che la risposta sia JSON

        console.log(`DEBUG transcribeAudio: Invio a Whisper con filename: ${filename}, contentType: ${clientContentType || 'audio/webm'}`);

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData,
        });

        const responseBodyText = await whisperResponse.text(); // Leggi sempre il corpo per debug
        console.log("DEBUG transcribeAudio: Risposta grezza da Whisper:", responseBodyText);

        if (!whisperResponse.ok) {
            let errorDetails = `Errore ${whisperResponse.status}: ${responseBodyText}`;
            try {
                const errorData = JSON.parse(responseBodyText); // Prova a parsare il testo come JSON
                errorDetails = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
                // Se non è JSON, errorDetails contiene già responseBodyText
            }
            console.error("Errore API Whisper:", whisperResponse.status, errorDetails);
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione.", details: errorDetails });
        }

        const transcriptionData = JSON.parse(responseBodyText); // Ora dovrebbe essere JSON valido
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: transcriptionData.text });

    } catch (error) {
        console.error("Errore generico in transcribeAudio:", error);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione.", details: error.message });
    }
}
