import OpenAI from 'openai';

// Funzione per impostare gli header CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { conversation, userId } = req.body;

    if (!conversation || !userId) {
        return res.status(400).json({ error: 'Dati mancanti' });
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Formatta la conversazione
        const conversationText = conversation.map(msg => 
            `${msg.speaker}: ${msg.content}`
        ).join('\n');

        // Estrai informazioni importanti con GPT-4
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Estrai informazioni importanti dall'utente in questa conversazione.
                    Cerca:
                    - Nomi di familiari o persone importanti (tipo: "famiglia" o "persona")
                    - Date importanti, compleanni, anniversari (tipo: "data")
                    - Luoghi di residenza, lavoro, preferiti (tipo: "luogo")  
                    - Preferenze, hobby, interessi (tipo: "preferenza")
                    - Progetti, obiettivi, piani (tipo: "progetto")
                    - Altre info personali rilevanti (tipo: "altro")
                    
                    Ogni informazione deve avere:
                    - type: uno dei tipi sopra
                    - info: l'informazione estratta (concisa)
                    - context: contesto breve
                    - confidence: "alta", "media", o "bassa"
                    
                    IMPORTANTE: Estrai SOLO informazioni dette dall'UTENTE, non dall'AI.
                    Rispondi SOLO in formato JSON con array "importantInfo".`
                },
                {
                    role: "user",
                    content: conversationText
                }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        return res.status(200).json({
            importantInfo: result.importantInfo || [],
            extractedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Errore estrazione info:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 