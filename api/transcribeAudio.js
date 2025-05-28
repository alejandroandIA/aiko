// api/transcribeAudio.js
import FormData from 'form-data';
import fetch from 'node-fetch'; // Usiamo node-fetch per robustezza nelle serverless functions

// Configurazione per Vercel per disabilitare il body parser di default
// e permetterci di leggere il flusso grezzo della richiesta.
export const config = {
    api: {
        bodyParser: false,
    },
};

// Funzione helper per leggere il corpo grezzo della richiesta (stream)
async function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        req.on('error', err => {
            console.error('Errore durante la lettura del flusso della richiesta:', err);
            reject(new Error('Errore lettura stream audio'));
        });
    });
}

export default async function handler(req, res) {
    // Gestione richiesta OPTIONS per CORS (necessaria se il client è su un dominio diverso in dev)
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Sii più restrittivo in produzione
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

        // Determina il filename e l'estensione dall'header Content-Type inviato dal client
        const clientContentType = req.headers['content-type'] || 'audio/webm';
        let filename = 'audio.webm'; // Default, Whisper la supporta
        if (clientContentType.includes('mp4')) filename = 'audio.mp4';
        else if (clientContentType.includes('mpeg') || clientContentType.includes('mp3')) filename = 'audio.mp3';
        else if (clientContentType.includes('wav')) filename = 'audio.wav';
        else if (clientContentType.includes('ogg')) filename = 'audio.ogg';
        // Assicurati che l'estensione sia una di quelle supportate da Whisper
        console.log(`DEBUG api/transcribeAudio: Content-Type client: ${clientContentType}, Filename per Whisper: ${filename}`);

        const form = new FormData();
        // Il buffer audio DEVE essere passato qui.
        // Whisper ha bisogno di un filename con estensione valida per capire il formato.
        form.append('file', audioBuffer, {
            filename: filename,
            contentType: clientContentType, // Anche se Whisper si basa sull'estensione, è buona norma
        });
        form.append('model', 'whisper-1');
        // Puoi aggiungere altri parametri opzionali come 'language', 'prompt', etc.
        // form.append('language', 'it'); // Se sai che l'audio è sempre in italiano

        console.log(`DEBUG api/transcribeAudio: FormData preparato. Invio a OpenAI Whisper API...`);

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                ...form.getHeaders(), // Fondamentale: questo imposta Content-Type: multipart/form-data; boundary=...
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: form, // Il FormData stesso
        });

        const responseBodyText = await whisperResponse.text(); // Leggi sempre il corpo per il debug, anche in caso di errore

        if (!whisperResponse.ok) {
            console.error(`Errore dall'API Whisper: ${whisperResponse.status} ${whisperResponse.statusText}`);
            console.error("Dettagli errore Whisper:", responseBodyText);
            let errorDetails = `Errore API Whisper (${whisperResponse.status})`;
            try {
                const errorData = JSON.parse(responseBodyText); // OpenAI spesso restituisce JSON per gli errori
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
        
        res.setHeader('Access-Control-Allow-Origin', '*'); // Sii più restrittivo in produzione
        return res.status(200).json({ transcript: whisperData.text });

    } catch (error) {
        console.error("Errore generico nella serverless function api/transcribeAudio.js:", error);
        const errorMessage = error.message || "Errore sconosciuto durante l'elaborazione della richiesta.";
        // Includi lo stack trace solo in ambiente di sviluppo per motivi di sicurezza
        const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione audio.", details: errorMessage, stack: errorStack });
    }
}
