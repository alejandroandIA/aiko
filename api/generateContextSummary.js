// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.js'; // Assicurati che il percorso sia corretto

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
        const { data: chatHistory, error: historyError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at') // Seleziona solo i campi necessari
            .order('created_at', { ascending: false })
            .limit(30); // Aumentato a 30 per un contesto potenzialmente più ricco

        if (historyError) {
            console.error('Errore recupero cronologia per riassunto in generateContextSummary:', historyError);
            return res.status(200).json({ summary: `Nota per Aiko: C'è stato un errore nel recuperare la cronologia completa delle conversazioni passate con ${USER_NAME}. Procedi con cautela basandoti solo su questa sessione.` });
        }

        if (!chatHistory || chatHistory.length === 0) {
            console.log("generateContextSummary: Nessuna cronologia trovata per il riassunto.");
            return res.status(200).json({ summary: "" }); // Restituisce stringa vuota se non c'è storia
        }

        // Filtra solo le ultime N interazioni UTENTE e le relative risposte AI per non rendere il prompt troppo lungo e costoso
        // Questa è una logica semplificata, potrebbe essere migliorata
        const relevantHistory = chatHistory.filter(entry => entry.speaker === 'Tu' || entry.speaker === 'AI').slice(0, 15).reverse();


        const formattedHistory = relevantHistory
            .map(entry => `${entry.speaker === 'Tu' ? USER_NAME : AI_NAME} (${new Date(entry.created_at).toLocaleDateString('it-IT')}): ${entry.content}`)
            .join('\n');

        if (formattedHistory.trim() === "") {
             console.log("generateContextSummary: Cronologia formattata vuota dopo il filtro.");
            return res.status(200).json({ summary: "" });
        }

        const summaryPrompt = `Sei un assistente incaricato di creare un riassunto estremamente conciso (massimo 150-200 parole, idealmente meno) di una conversazione passata tra ${USER_NAME} e l'IA ${AI_NAME}. Questo riassunto verrà fornito ad ${AI_NAME} all'inizio di una nuova conversazione per darle contesto. Focalizzati ESCLUSIVAMENTE sui fatti chiave, dettagli personali, preferenze o intenzioni espresse da ${USER_NAME} che ${AI_NAME} dovrebbe assolutamente ricordare per personalizzare la conversazione. Sii fattuale e diretto. Se non ci sono informazioni significative su ${USER_NAME}, indicalo.

Cronologia chat rilevante (le date indicano quando è stato detto):
${formattedHistory}

Riassunto ultra-conciso dei dettagli più importanti su ${USER_NAME} da questa cronologia (se non ci sono dettagli salienti su ${USER_NAME}, scrivi "Nessun dettaglio personale chiave di ${USER_NAME} emerso dalla cronologia recente."):`;

        // console.log("DEBUG generateContextSummary - Prompt per OpenAI:", summaryPrompt);

        const openaiSummaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: `Assisti nel creare riassunti concisi di conversazioni passate focalizzati sui dettagli dell'utente ${USER_NAME}.` },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.1,
                max_tokens: 250, // Limite per la risposta del riassunto
            }),
        });

        if (!openaiSummaryResponse.ok) {
            const errorData = await openaiSummaryResponse.json().catch(() => ({ message: "Errore non JSON da OpenAI" }));
            console.error('Errore API OpenAI per riassunto:', openaiSummaryResponse.status, errorData);
            return res.status(200).json({ summary: `Nota per Aiko: Impossibile generare un riassunto delle conversazioni precedenti con ${USER_NAME} (errore API).` });
        }

        const summaryData = await openaiSummaryResponse.json();
        let summaryText = summaryData.choices?.[0]?.message?.content?.trim() || "";

        if (summaryText.toLowerCase().includes("nessun dettaglio personale chiave")) {
            summaryText = ""; // Se il riassunto dice che non c'è nulla, passiamo stringa vuota
        }

        console.log("generateContextSummary: Riassunto generato:", summaryText);
        res.setHeader('Access-Control-Allow-Origin', '*'); // Per testare da localhost
        return res.status(200).json({ summary: summaryText });

    } catch (e) {
        console.error('Errore generico in generateContextSummary:', e);
        return res.status(500).json({ error: 'Errore interno server durante generazione riassunto.', summary: `Nota per Aiko: Errore interno del server nel generare il riassunto per ${USER_NAME}.` });
    }
}
