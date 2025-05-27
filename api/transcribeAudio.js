// api/transcribeAudio.js
import FormData from 'form-data'; // Importa esplicitamente
// Non serve 'node-fetch' se l'ambiente Node di Vercel è >= 16.15 (per fetch globale) o >=18 (per FormData globale)
// Ma usare form-data esplicito è più sicuro per la parte multipart.

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
        const audioBlobBuffer = await req.buffer(); 
        
        if (!audioBlobBuffer || audioBlobBuffer.length === 0) {
            return res.status(400).json({ error: "Nessun dato audio ricevuto." });
        }

        const formData = new FormData();
        // Quando si usa il pacchetto 'form-data', si passa il buffer direttamente.
        // Il terzo argomento (nome file) è importante per Whisper.
        formData.append('file', audioBlobBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
        formData.append('model', 'whisper-1');
        formData.append('language', 'it');
        // formData.append('response_format', 'text'); // Whisper restituisce JSON di default, che contiene 'text'

        const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                // 'Content-Type' viene impostato da FormData con il boundary corretto
                ...formData.getHeaders() // Importante quando si usa il pacchetto 'form-data' con fetch
            },
            body: formData, // formData qui è un'istanza del pacchetto 'form-data'
        });

        if (!whisperResponse.ok) {
            const errorData = await whisperResponse.json().catch(() => ({}));
            console.error("Errore API Whisper:", whisperResponse.status, errorData.error || await whisperResponse.text());
            return res.status(whisperResponse.status).json({ error: "Errore durante la trascrizione.", details: errorData.error?.message || "Dettagli non disponibili" });
        }

        const transcriptionData = await whisperResponse.json();
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ transcript: transcriptionData.text });

    } catch (error) {
        console.error("Errore generico in transcribeAudio:", error);
        return res.status(500).json({ error: "Errore interno del server durante la trascrizione.", details: error.message });
    }
}
