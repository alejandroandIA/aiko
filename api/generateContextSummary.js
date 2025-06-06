// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

    const { userId, aiCharacter } = req.body;

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Recupera riassunti conversazioni recenti per questo utente e AI
        const { data: summaries, error: summariesError } = await supabase
            .from('conversation_summaries')
            .select('summary, key_points, emotions, topics, conversation_date')
            .eq('user_id', userId)
            .eq('ai_character', aiCharacter)
            .order('conversation_date', { ascending: false })
            .limit(10);

        if (summariesError) throw summariesError;

        // Recupera informazioni importanti per questo utente
        const { data: importantInfo, error: infoError } = await supabase
            .from('important_info')
            .select('type, info, context')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (infoError) throw infoError;

        // Se non c'è storia, ritorna stringa vuota
        if ((!summaries || summaries.length === 0) && (!importantInfo || importantInfo.length === 0)) {
            return res.status(200).json({ summary: "" });
        }

        // Prepara il prompt per generare il contesto
        let contextPrompt = `Genera un riassunto conciso delle conversazioni precedenti e informazioni importanti per la prossima conversazione.

RIASSUNTI CONVERSAZIONI RECENTI:
`;

        summaries?.forEach((summary, idx) => {
            contextPrompt += `\n[Conversazione ${idx + 1} - ${new Date(summary.conversation_date).toLocaleDateString('it-IT')}]`;
            contextPrompt += `\nRiassunto: ${summary.summary}`;
            if (summary.key_points?.length > 0) {
                contextPrompt += `\nPunti chiave: ${summary.key_points.join(', ')}`;
            }
            if (summary.topics?.length > 0) {
                contextPrompt += `\nArgomenti: ${summary.topics.join(', ')}`;
            }
            contextPrompt += '\n';
        });

        contextPrompt += `\n\nINFORMAZIONI IMPORTANTI SULL'UTENTE:\n`;
        
        const groupedInfo = {};
        importantInfo?.forEach(info => {
            if (!groupedInfo[info.type]) {
                groupedInfo[info.type] = [];
            }
            groupedInfo[info.type].push(info.info);
        });

        Object.entries(groupedInfo).forEach(([type, infos]) => {
            contextPrompt += `\n${type.toUpperCase()}: ${infos.join(', ')}`;
        });

        contextPrompt += `\n\nCrea un riassunto MOLTO CONCISO (max 200 parole) che catturi:
1. Chi è l'utente e informazioni personali chiave
2. Argomenti ricorrenti o interessi
3. Tono delle conversazioni precedenti
4. Qualsiasi informazione rilevante per personalizzare la prossima conversazione

Il riassunto deve essere scritto come memoria diretta, non come report.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Sei un assistente che crea riassunti concisi di memoria per conversazioni future. Scrivi in prima persona come se fossi l'AI che ricorda."
                },
                {
                    role: "user",
                    content: contextPrompt
                }
            ],
            temperature: 0.7,
            max_tokens: 400
        });

        const contextSummary = completion.choices[0].message.content.trim();

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ summary: contextSummary });

    } catch (error) {
        console.error('Errore generazione contesto:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}
