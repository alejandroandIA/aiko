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
    const handlerStartTime = Date.now();
    console.log(`[${new Date(handlerStartTime).toISOString()}] DEBUG api/transcribeAudio: Inizio handler.`);

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Risposta a OPTIONS. Durata: ${Date.now() - handlerStartTime}ms`);
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        console.warn(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Metodo ${req.method} non permesso. Durata: ${Date.now() - handlerStartTime}ms`);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed, use POST.` });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.error(`[${new Date().toISOString()}] ERRORE FATALE in api/transcribeAudio: OPENAI_API_KEY non configurata.`);
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    try {
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Inizio gestione richiesta POST.`);
        const bodyParseStartTime = Date.now();
        const audioBuffer = await getRawBody(req);
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Corpo audio letto. Durata lettura: ${Date.now() - bodyParseStartTime}ms`);

        if (!audioBuffer || audioBuffer.length === 0) {
            console.warn(`[${new Date().toISOString()}] api/transcribeAudio: Ricevuto corpo audio vuoto o non valido.`);
            return res.status(400).json({ error: 'Corpo audio vuoto o non valido.' });
        }
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Audio buffer ricevuto, lunghezza: ${audioBuffer.length}`);

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

        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Content-Type client: ${clientContentType}, Filename per Whisper: ${filename}`);

        const form = new FormData();
        form.append('file', audioBuffer, {
            filename: filename, // Nome file corretto
            contentType: clientContentType, // Questo è più per informazione, Whisper si basa sull'estensione
        });
        form.append('model', 'whisper-1');
        // form.append('language', 'it'); // Rimosso per auto-detect della lingua
        // form.append('prompt', 'Conversazione in italiano tra Alejandro e Aiko.'); // Rimosso prompt specifico
        form.append('prompt', 'Aiko, Alejandro, OpenAI, Supabase.'); // Nuovo prompt minimale per termini chiave

        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: FormData preparato con prompt minimale. Invio a OpenAI Whisper API...`);

        const WHISPER_API_TIMEOUT_MS = 60000; // Aumento a 60 secondi
        let whisperResponse;
        const whisperCallStartTime = Date.now();

        try {
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

            whisperResponse = await Promise.race([fetchPromise, timeoutPromise]);

            if (whisperResponse instanceof Error) { // Se è l'errore di timeout da timeoutPromise
                console.error(`[${new Date().toISOString()}] Timeout API Whisper (interno): ${whisperResponse.message}. Durata chiamata Whisper: ${Date.now() - whisperCallStartTime}ms`);
                return res.status(408).json({ error: "La trascrizione dell'audio ha impiegato troppo tempo (timeout interno).", details: whisperResponse.message });
            }
            console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Risposta da Whisper ricevuta (prima di .text()). Status: ${whisperResponse.status}. Durata chiamata Whisper: ${Date.now() - whisperCallStartTime}ms`);

        } catch (error) {
            if (error.message && error.message.startsWith('Timeout API Whisper')) {
                console.error(`[${new Date().toISOString()}] Errore di Timeout Interno Catturato: ${error.message}. Durata chiamata Whisper: ${Date.now() - whisperCallStartTime}ms`);
                return res.status(408).json({ error: "La trascrizione dell'audio ha impiegato troppo tempo (timeout).", details: error.message });
            }
            // Altri errori di rete o fetch
            console.error(`[${new Date().toISOString()}] Errore durante la chiamata fetch a Whisper:`, error, `. Durata chiamata Whisper (parziale): ${Date.now() - whisperCallStartTime}ms`);
            return res.status(500).json({ error: "Errore di rete durante la comunicazione con l'API Whisper.", details: error.message });
        }

        const responseBodyParseStartTime = Date.now();
        const responseBodyText = await whisperResponse.text();
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Corpo risposta Whisper letto (.text()). Durata lettura corpo: ${Date.now() - responseBodyParseStartTime}ms`);

        if (!whisperResponse.ok) {
            console.error(`[${new Date().toISOString()}] Errore dall'API Whisper: ${whisperResponse.status} ${whisperResponse.statusText}. Corpo: ${responseBodyText.substring(0,500)}`);
            let errorDetails = `Errore API Whisper (${whisperResponse.status})`;
            try {
                const errorData = JSON.parse(responseBodyText);
                errorDetails = errorData.error?.message || JSON.stringify(errorData.error) || responseBodyText;
            } catch (e) { /* usa responseBodyText se non è JSON */ }
            console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Invio errore ${whisperResponse.status} al client. Durata totale handler: ${Date.now() - handlerStartTime}ms`);
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione audio con OpenAI Whisper.", details: errorDetails });
        }

        const whisperData = JSON.parse(responseBodyText);

        if (typeof whisperData.text !== 'string') {
            console.error(`[${new Date().toISOString()}] Risposta da Whisper non contiene il campo 'text' atteso:`, whisperData);
            console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Invio errore 500 al client. Durata totale handler: ${Date.now() - handlerStartTime}ms`);
            return res.status(500).json({ error: "Formato risposta trascrizione inatteso da OpenAI." });
        }
        
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Trascrizione ricevuta: "${whisperData.text.substring(0,100)}...". Durata totale handler: ${Date.now() - handlerStartTime}ms`);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: whisperData.text });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Errore generico in api/transcribeAudio.js:`, error);
        const errorMessage = error.message || "Errore sconosciuto durante l'elaborazione della richiesta.";
        const errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
        console.log(`[${new Date().toISOString()}] DEBUG api/transcribeAudio: Invio errore 500 (generico) al client. Durata totale handler: ${Date.now() - handlerStartTime}ms`);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione audio.", details: errorMessage, stack: errorStack });
    }
}
