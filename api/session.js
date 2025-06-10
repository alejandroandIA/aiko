// api/session.js
// Questo file gestisce la creazione di sessioni temporanee con OpenAI Realtime API.
// Quando un utente inizia una conversazione con un personaggio AI:
// 1. Riceve userId, aiCharacter e model dal frontend
// 2. Usa la chiave API di OpenAI (protetta su Vercel) per creare una sessione
// 3. Ottiene un token effimero (client_secret) che il frontend userà per la connessione WebRTC
// 4. Il token ha una scadenza limitata per sicurezza
// Questo approccio mantiene la chiave API sicura sul server mentre permette connessioni dirette dal browser

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed, use POST.`);
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        console.error('ERRORE FATALE: OPENAI_API_KEY non configurata.');
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    const { contextSummary, userId, aiCharacter, model } = req.body;

    if (!userId || !aiCharacter) {
        return res.status(400).json({ error: "userId e aiCharacter sono richiesti" });
    }

    const requestModel = model || "gpt-4o-realtime-preview-2024-12-17";

    try {
        // Crea una sessione temporanea per ottenere un token effimero
        const openAIResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: requestModel,
                voice: "shimmer" // Default, verrà sovrascritto dal client
            }),
        });

        if (!openAIResponse.ok) {
            const errorData = await openAIResponse.json().catch(() => ({ error: "Impossibile parsare l'errore" }));
            console.error("Errore dalla API OpenAI:", openAIResponse.status, errorData);
            return res.status(openAIResponse.status).json({ error: "Errore durante la creazione della sessione", details: errorData });
        }

        const data = await openAIResponse.json();

        if (!data.client_secret || !data.client_secret.value) {
            console.error("Risposta da OpenAI non contiene client_secret:", data);
            return res.status(500).json({ error: "Formato token effimero inatteso" });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ 
            client_secret: data.client_secret.value,
            expires_at: data.client_secret.expires_at
        });

    } catch (error) {
        console.error("Errore generico in api/session.js:", error);
        return res.status(500).json({ error: "Errore interno del server", details: error.message });
    }
}
