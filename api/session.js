// api/session.js
import { getBaseInstructions, AI_NAME, USER_NAME } from '../src/config/aiConfig.mjs'; // Assicurati che il percorso sia corretto!

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Accetta POST
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') { // Deve essere POST per ricevere il contextSummary nel body
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed, use POST.`);
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
        console.error('ERRORE FATALE in api/session: OPENAI_API_KEY non configurata.');
        return res.status(500).json({ error: "Configurazione del server incompleta: OPENAI_API_KEY non configurata." });
    }

    let contextSummary = "";
    // Estrai il contextSummary dal corpo della richiesta, se presente
    if (req.body && req.body.contextSummary && typeof req.body.contextSummary === 'string') {
        contextSummary = req.body.contextSummary.trim();
        console.log("Session API: Ricevuto contextSummary");
    } else {
        console.log("DEBUG api/session.js: Nessun contextSummary ricevuto dal client.");
    }

    // Usa la funzione da aiConfig.js per ottenere le istruzioni complete
    const system_instructions = getBaseInstructions(contextSummary, AI_NAME, USER_NAME);
    // console.log("DEBUG api/session.js: Istruzioni finali inviate a OpenAI (prime 300char):", system_instructions.substring(0, 300) + "...");

    try {
        // Per WebRTC, creiamo una sessione temporanea per ottenere un token effimero
        const openAIResponse = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "shimmer"
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
            expires_at: data.client_secret.expires_at,
            instructions: getBaseInstructions(contextSummary, AI_NAME, USER_NAME)
        });

    } catch (error) {
        console.error("Errore generico in api/session.js:", error);
        return res.status(500).json({ error: "Errore interno del server", details: error.message });
    }
}
