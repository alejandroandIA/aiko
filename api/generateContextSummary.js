// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.js'; // <<<< PERCORSO CORRETTO

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end('Method Not Allowed');
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !OPENAI_API_KEY) {
        console.error('generateContextSummary: Variabili ambiente mancanti.');
        return res.status(500).json({ error: 'Configurazione server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data: chatHistory, error: historyError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (historyError) {
            console.error('Errore recupero cronologia per riassunto:', historyError);
            return res.status(200).json({ summary: "Errore recupero cronologia." });
        }
        if (!chatHistory || chatHistory.length === 0) {
            return res.status(200).json({ summary: "" });
        }

        const formattedHistory = chatHistory
            .reverse()
            .map(entry => `${entry.speaker === 'Tu' ? USER_NAME : AI_NAME}: ${entry.content}`)
            .join('\n');

        const summaryPrompt = `Data la seguente cronologia di chat tra ${USER_NAME} e ${AI_NAME}, estrai i punti chiave, le preferenze menzionate da ${USER_NAME}, i dati personali rivelati da ${USER_NAME} e i temi principali discussi. Fornisci un riassunto molto conciso (max 150-200 parole) focalizzato sulle informazioni riguardanti ${USER_NAME}. Questo riassunto darà contesto ad ${AI_NAME} all'inizio di una nuova conversazione.

Cronologia chat recente:
${formattedHistory}

Riassunto conciso dei fatti e dettagli chiave APPRESI SU ${USER_NAME} e sulle vostre interazioni passate:`;

        const openaiSummaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: `Sei un assistente che riassume conversazioni tra ${USER_NAME} e ${AI_NAME}, focalizzandoti sui dettagli appresi su ${USER_NAME}.` },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.2, max_tokens: 250,
            }),
        });

        if (!openaiSummaryResponse.ok) {
            const errorData = await openaiSummaryResponse.json().catch(() => null);
            console.error('Errore API OpenAI riassunto:', openaiSummaryResponse.status, errorData);
            return res.status(200).json({ summary: "Errore generazione riassunto." });
        }
        const summaryData = await openaiSummaryResponse.json();
        const summaryText = summaryData.choices?.[0]?.message?.content?.trim() || "";
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ summary: summaryText });
    } catch (e) {
        console.error('Errore generico generateContextSummary:', e);
        return res.status(500).json({ error: 'Errore interno server riassunto.' });
    }
}
