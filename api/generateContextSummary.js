// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs';

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
        return res.status(500).json({ error: 'Configurazione server incompleta.', summary: "" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Tentiamo di recuperare un numero maggiore di messaggi per un riassunto più ricco
        const { data: chatHistory, error: historyError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .order('created_at', { ascending: false })
            .limit(40); // Aumentato a 40

        if (historyError) {
            console.error('Errore recupero cronologia per riassunto:', historyError);
            return res.status(200).json({ summary: `Nota per ${AI_NAME}: Errore nel recuperare la cronologia. Procedi con cautela.` });
        }

        if (!chatHistory || chatHistory.length === 0) {
            return res.status(200).json({ summary: "" });
        }

        // Diamo priorità alle ultime interazioni, ma cerchiamo di avere un mix
        const formattedHistory = chatHistory
            .reverse() // Ordine cronologico per il prompt
            .map(entry => `${entry.speaker === 'Tu' ? USER_NAME : AI_NAME} (il ${new Date(entry.created_at).toLocaleDateString('it-IT')}): ${entry.content}`)
            .join('\n');

        if (formattedHistory.trim() === "") {
            return res.status(200).json({ summary: "" });
        }

        const summaryPrompt = `Sei ${AI_NAME}, un'IA che sta per iniziare una nuova conversazione con ${USER_NAME}. Per aiutarti a ricordare, rileggi la seguente cronologia delle vostre interazioni passate (principalmente le tue risposte, ma cerca anche indizi su ${USER_NAME} se presenti). Estrai i fatti e i dettagli più salienti riguardanti ${USER_NAME} (sue preferenze, dati personali condivisi, argomenti importanti per lui) e i temi principali delle TUE risposte che potrebbero essere rilevanti per continuare la conversazione in modo coerente e personale. Formula un riassunto molto conciso (massimo 200-250 parole) sotto forma di "Appunti per Aiko su Alejandro".

Cronologia chat rilevante:
${formattedHistory}

Appunti per Aiko su Alejandro (massimo 200-250 parole, focalizzati su ciò che è utile ricordare per la prossima interazione):`;

        const openaiSummaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: `Sei un eccellente assistente nel creare appunti concisi da conversazioni passate per un'IA di nome ${AI_NAME} che parla con ${USER_NAME}.` },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.2,
                max_tokens: 300,
            }),
        });

        if (!openaiSummaryResponse.ok) {
            const errorData = await openaiSummaryResponse.json().catch(() => null);
            console.error('Errore API OpenAI riassunto:', openaiSummaryResponse.status, errorData);
            return res.status(200).json({ summary: `Nota per ${AI_NAME}: Impossibile generare appunti dalle conversazioni precedenti.` });
        }
        const summaryData = await openaiSummaryResponse.json();
        let summaryText = summaryData.choices?.[0]?.message?.content?.trim() || "";

        if (summaryText.toLowerCase().includes("nessun dettaglio") || summaryText.toLowerCase().includes("nessuna informazione")) {
            summaryText = ""; // Non passare un riassunto vuoto o negativo
        }

        console.log("generateContextSummary: Riassunto/Appunti generati:", summaryText);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ summary: summaryText });

    } catch (e) {
        console.error('Errore generico generateContextSummary:', e);
        return res.status(500).json({ error: 'Errore interno server riassunto.', summary: `Nota per ${AI_NAME}: Errore interno server nel generare appunti.` });
    }
}
