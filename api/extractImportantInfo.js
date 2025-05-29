export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY non configurata' });
    }

    try {
        const { conversation } = req.body;
        
        if (!conversation || !Array.isArray(conversation)) {
            return res.status(400).json({ error: 'Conversazione non valida' });
        }

        // Prepara il testo della conversazione
        const conversationText = conversation
            .map(entry => `${entry.speaker}: ${entry.content}`)
            .join('\n');

        // Chiedi a GPT di estrarre informazioni importanti
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Sei un assistente che estrae informazioni importanti e personali dalle conversazioni.
                        
ESTRAI SOLO informazioni FATTUALI e PERSONALI come:
- Nomi di persone (familiari, amici, colleghi)
- Relazioni familiari specifiche
- Date importanti (compleanni, anniversari)
- Luoghi significativi
- Preferenze personali dichiarate esplicitamente
- Progetti o attività in corso
- Informazioni di contatto o identificative

NON estrarre:
- Saluti generici
- Commenti vaghi
- Domande senza risposta
- Speculazioni o ipotesi

Formato output JSON:
{
  "important_facts": [
    {
      "type": "famiglia|persona|data|luogo|preferenza|progetto|altro",
      "info": "descrizione breve e chiara",
      "context": "contesto minimo per capire",
      "confidence": "alta|media|bassa"
    }
  ],
  "summary": "riassunto brevissimo delle info più rilevanti"
}`
                    },
                    {
                        role: 'user',
                        content: conversationText
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Errore OpenAI:', error);
            return res.status(500).json({ error: 'Errore estrazione informazioni' });
        }

        const data = await response.json();
        let extractedInfo = { important_facts: [], summary: "" }; // Valore di default

        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            try {
                extractedInfo = JSON.parse(data.choices[0].message.content);
            } catch (parseError) {
                console.error('Errore parsing JSON dalla risposta di OpenAI in extractImportantInfo:', parseError);
                console.error('Contenuto ricevuto da OpenAI che ha causato errore di parsing:', data.choices[0].message.content);
                // Non restituire un errore 500 qui, ma piuttosto un set di risultati vuoto o parziale se possibile.
                // In questo caso, restituiremo il valore di default (vuoto).
                // Potresti anche decidere di inviare una notifica o loggare questo evento in modo più specifico.
            }
        } else {
            console.warn('Risposta da OpenAI non conteneva il percorso atteso per il contenuto del messaggio in extractImportantInfo.', data);
        }

        return res.status(200).json(extractedInfo);

    } catch (error) {
        console.error('Errore in extractImportantInfo:', error);
        return res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
} 