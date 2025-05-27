// api/transcribeAudio.js
// Assicurati che Vercel possa gestire l'upload di blob/file o stream audio.
// Per semplicità, questo esempio assume che il client invii l'audio come FormData
// o che possiamo gestire un blob audio direttamente se la versione Node di Vercel lo supporta con fetch.
// L'uso di FormData è più standard per inviare file/blob a un endpoint.
// Sarà necessario installare 'form-data' se il client invia FormData: npm install form-data

// import FormData from 'form-data'; // Decommenta se il client invia FormData e Node < 18 non ha FormData globale
// import fetch from 'node-fetch'; // Decommenta se Node < 18

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
        // Il client invierà l'audio come blob nel corpo della richiesta.
        // Dobbiamo ricostruire un FormData o inviare il blob direttamente.
        // OpenAI Whisper API si aspetta multipart/form-data.
        const audioBlobBuffer = await req.buffer(); // Vercel helper per ottenere il buffer del body
        
        if (!audioBlobBuffer || audioBlobBuffer.length === 0) {
            return res.status(400).json({ error: "Nessun dato audio ricevuto." });
        }

        const formData = new FormData();
        // OpenAI si aspetta un file. Dobbiamo dargli un nome, anche se fittizio.
        // Il tipo MIME corretto è importante. WebM è un formato comune.
        formData.append('file', new Blob([audioBlobBuffer]), { filename: 'audio.webm', contentType: 'audio/webm' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'it'); // Specifica la lingua per una migliore accuratezza
        // formData.append('response_format', 'text'); // Per avere solo il testo semplice

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                // 'Content-Type' sarà impostato automaticamente da fetch quando usi FormData
            },
            body: formData,
        });

        if (!whisperResponse.ok) {
            const errorData = await whisperResponse.json().catch(() => ({}));
            console.error("Errore API Whisper:", whisperResponse.status, errorData.error || await whisperResponse.text());
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione.", details: errorData.error?.message || "Dettagli non disponibili" });
        }

        const transcriptionData = await whisperResponse.json();
        
        res.setHeader('Access-Control-Allow-Origin', '*'); // Per sviluppo
        return res.status(200).json({ transcript: transcriptionData.text });

    } catch (error) {
        console.error("Errore generico in transcribeAudio:", error);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione.", details: error.message });
    }
}
