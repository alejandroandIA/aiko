export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // POST è per OpenAI, GET per la tua chiamata
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') { // Questa funzione API è chiamata con GET dal client
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        console.error('ERRORE FATALE in api/session: OPENAI_API_KEY non configurata nelle environment variables di Vercel.');
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    try {
        const openAIResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "shimmer",
                instructions: "Sei un assistente AI amichevole. Rispondi in italiano. Sii divertente. Fai tante risate."
                // Aggiungi qui eventuali tools se vuoi che siano disponibili globalmente per la sessione
            }),
        });

        if (!openAIResponse.ok) {
            const errorData = await openAIResponse.json().catch(() => null); // Prova a parsare l'errore JSON
            console.error("Errore dalla API OpenAI durante la creazione della sessione:", openAIResponse.status, errorData || await openAIResponse.text());
            return res.status(openAIResponse.status).json({ error: "Errore durante la creazione della sessione OpenAI.", details: errorData || "Dettagli non disponibili" });
        }

        const data = await openAIResponse.json();

        if (!data.client_secret || !data.client_secret.value) {
            console.error("Risposta da OpenAI per la sessione non contiene client_secret.value:", data);
            return res.status(500).json({ error: "Formato token effimero inatteso dalla API OpenAI." });
        }

        res.setHeader('Access-Control-Allow-Origin', '*'); 
        return res.status(200).json({ client_secret: data.client_secret.value });

    } catch (error) {
        console.error("Errore generico nella serverless function api/session.js:", error);
        return res.status(500).json({ error: "Errore interno del server durante la creazione della sessione.", details: error.message });
    }
}
