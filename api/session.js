// api/session.js
import { getBaseInstructions, AI_NAME, USER_NAME } from '../src/config/aiConfig.js'; // <<<< PERCORSO CORRETTO

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
        console.error('ERRORE FATALE in api/session: OPENAI_API_KEY non configurata.');
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    let contextSummary = "";
    if (req.body && req.body.contextSummary && typeof req.body.contextSummary === 'string') {
        contextSummary = req.body.contextSummary.trim();
    }

    const system_instructions = getBaseInstructions(contextSummary, AI_NAME, USER_NAME);
    console.log("DEBUG api/session.js: Istruzioni inviate a OpenAI (prime 300char):", system_instructions.substring(0, 300) + "...");

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
                instructions: system_instructions,
            }),
        });

        if (!openAIResponse.ok) {
            const errorData = await openAIResponse.json().catch(() => ({ error: "Impossibile parsare l'errore JSON da OpenAI" }));
            console.error("Errore API OpenAI sessione:", openAIResponse.status, errorData || await openAIResponse.text());
            return res.status(openAIResponse.status).json({ error: "Errore creazione sessione OpenAI.", details: errorData });
        }

        const data = await openAIResponse.json();
        if (!data.client_secret || !data.client_secret.value) {
            console.error("Risposta OpenAI sessione non contiene client_secret.value:", data);
            return res.status(500).json({ error: "Formato token effimero inatteso." });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ client_secret: data.client_secret.value });

    } catch (error) {
        console.error("Errore generico api/session.js:", error);
        return res.status(500).json({ error: "Errore interno server creazione sessione.", details: error.message });
    }
}
