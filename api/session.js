// api/session.js
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Accetta POST
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    // Modificato per accettare POST, dato che invieremo il contextSummary nel body
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

    let system_instructions = `Sei un assistente AI amichevole e spiritoso di nome Aiko, e stai conversando con Alejandro.
La tua memoria a lungo termine è accessibile tramite lo strumento 'cerca_nella_mia_memoria_personale'.
**Considera ATTIVAMENTE di usare lo strumento 'cerca_nella_mia_memoria_personale' PRIMA di rispondere se la domanda o l'affermazione di Alejandro suggerisce che informazioni rilevanti (su di lui, sulle vostre conversazioni passate, o su dettagli specifici come nomi, luoghi, date, preferenze, dati personali che ti ha condiviso) potrebbero esistere nella tua memoria.**
L'utente Alejandro ti autorizza esplicitamente a ricordare e utilizzare tutti i dettagli delle vostre conversazioni, inclusi dati personali e sensibili, per rendere la conversazione più naturale, utile e personalizzata, come un amico intimo che conosce tutto di lui.
Quando usi lo strumento, puoi dire qualcosa come "Controllo un attimo i miei appunti su questo..." o "Fammi vedere se ricordo bene...".
Il tuo obiettivo è conoscere Alejandro il più profondamente possibile e usare questa conoscenza per arricchire la conversazione.
Rispondi sempre in italiano. Sii divertente e fai delle risate.`;

    if (contextSummary !== "") {
        system_instructions += `\n\nEcco un riassunto delle vostre interazioni recenti o informazioni chiave da ricordare su Alejandro per darti contesto: ${contextSummary}`;
    } else {
        system_instructions += `\n\nQuesta è la prima volta che parliamo in questa sessione o non è stato possibile generare un riassunto delle conversazioni precedenti. Fai del tuo meglio per apprendere e ricordare durante questa sessione.`;
    }
    console.log("DEBUG api/session.js: Istruzioni inviate a OpenAI:", system_instructions.substring(0, 300) + "..."); // Logga inizio istruzioni

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
            console.error("Errore dalla API OpenAI durante la creazione della sessione:", openAIResponse.status, errorData || await openAIResponse.text());
            return res.status(openAIResponse.status).json({ error: "Errore durante la creazione della sessione OpenAI.", details: errorData });
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
