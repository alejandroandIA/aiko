// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') { // Questo endpoint sarà chiamato con GET dal client
        res.setHeader('Allow', ['GET']);
        return res.status(405).end('Method Not Allowed');
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !OPENAI_API_KEY) {
        console.error('generateContextSummary: Variabili d\'ambiente mancanti.');
        return res.status(500).json({ error: 'Configurazione del server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data: chatHistory, error: historyError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .order('created_at', { ascending: false })
            .limit(20); // Recupera le ultime 20 interazioni

        if (historyError) {
            console.error('Errore recupero cronologia per riassunto in generateContextSummary:', historyError);
            // Restituisce un oggetto con summary vuoto così il client può gestire
            return res.status(200).json({ summary: "Errore recupero cronologia per riassunto." });
        }

        if (!chatHistory || chatHistory.length === 0) {
            return res.status(200).json({ summary: "" }); // Nessuna storia, nessun riassunto
        }

        const formattedHistory = chatHistory
            .reverse()
            .map(entry => `${entry.speaker === 'Tu' ? 'Alejandro' : 'Aiko'}: ${entry.content}`)
            .join('\n');

        const summaryPrompt = `Data la seguente cronologia di chat tra Alejandro e Aiko, estrai i punti chiave, le preferenze menzionate da Alejandro, i dati personali rivelati da Alejandro (nomi, luoghi, date importanti, dettagli familiari, ecc.) e i temi principali discussi. Fornisci un riassunto molto conciso (massimo 150-200 parole) focalizzato sulle informazioni riguardanti Alejandro. Questo riassunto verrà usato per dare contesto ad Aiko all'inizio di una nuova conversazione con Alejandro.

Cronologia chat recente:
${formattedHistory}

Riassunto conciso dei fatti e dettagli chiave APPRESI SU ALEJANDRO e sulle vostre interazioni passate:`;

        const openaiSummaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o", // O un altro modello potente per riassunti
                messages: [
                    { role: "system", content: "Sei un eccellente assistente nel riassumere testi di conversazioni, focalizzandoti sui dettagli dell'utente." },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.2,
                max_tokens: 250,
            }),
        });

        if (!openaiSummaryResponse.ok) {
            const errorData = await openaiSummaryResponse.json().catch(() => null);
            console.error('Errore API OpenAI per riassunto in generateContextSummary:', openaiSummaryResponse.status, errorData || await openaiSummaryResponse.text());
            return res.status(200).json({ summary: "Errore durante la generazione del riassunto." });
        }

        const summaryData = await openaiSummaryResponse.json();
        const summaryText = summaryData.choices && summaryData.choices[0] && summaryData.choices[0].message && summaryData.choices[0].message.content
            ? summaryData.choices[0].message.content.trim()
            : "";

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ summary: summaryText });

    } catch (e) {
        console.error('Errore generico in generateContextSummary:', e);
        return res.status(500).json({ error: 'Errore interno del server durante la generazione del riassunto.' });
    }
}
