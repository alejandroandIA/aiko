// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !OPENAI_API_KEY) {
        console.error('Variabili d\'ambiente mancanti.');
        return res.status(500).json({ error: 'Configurazione del server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Recupera le informazioni importanti
        const { data: importantInfo, error: infoError } = await supabase
            .from('important_info')
            .select('*')
            .order('created_at', { ascending: false });

        if (infoError) {
            console.warn('Errore recupero important_info:', infoError);
        }

        // 2. Recupera le conversazioni recenti (ultime 48 ore)
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
        
        const { data: recentHistory, error: historyError } = await supabase
            .from('chat_history')
            .select('speaker, content, created_at')
            .gte('created_at', fortyEightHoursAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(50);

        if (historyError) {
            console.error('Errore recupero cronologia chat:', historyError);
            return res.status(500).json({ error: 'Errore nel recupero della cronologia.' });
        }

        // 3. Prepara il contesto per GPT
        let contextText = "";

        // Aggiungi informazioni importanti
        if (importantInfo && importantInfo.length > 0) {
            contextText += "INFORMAZIONI IMPORTANTI SALVATE:\n";
            
            const grouped = {};
            importantInfo.forEach(item => {
                if (!grouped[item.type]) grouped[item.type] = [];
                grouped[item.type].push(item);
            });

            for (const [type, items] of Object.entries(grouped)) {
                contextText += `\n${type.toUpperCase()}:\n`;
                items.forEach(item => {
                    contextText += `- ${item.info}`;
                    if (item.context) contextText += ` (${item.context})`;
                    contextText += '\n';
                });
            }
            contextText += "\n---\n\n";
        }

        // Aggiungi conversazioni recenti
        if (recentHistory && recentHistory.length > 0) {
            contextText += "CONVERSAZIONI RECENTI:\n";
            recentHistory.reverse().forEach(msg => {
                const speaker = msg.speaker === 'Tu' ? USER_NAME : msg.speaker === 'AI' ? AI_NAME : msg.speaker;
                contextText += `${speaker}: ${msg.content}\n`;
            });
        }

        if (!contextText) {
            return res.status(200).json({ 
                summary: "Non ci sono conversazioni recenti o informazioni salvate.",
                important_facts: []
            });
        }

        // 4. Genera il riassunto con GPT
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${OPENAI_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Sei ${AI_NAME}. Genera un riassunto delle informazioni e conversazioni recenti per ricordare il contesto quando parlerai con ${USER_NAME}.

FOCUS su:
1. Informazioni personali importanti (nomi, relazioni, preferenze)
2. Argomenti di conversazione in corso
3. Progetti o attività menzionate
4. Domande rimaste in sospeso

Il riassunto deve essere in PRIMA PERSONA come se fossi tu (${AI_NAME}) che ricordi.
Massimo 200 parole, molto conciso e diretto.`
                    },
                    {
                        role: "user",
                        content: contextText
                    }
                ],
                temperature: 0.3,
                max_tokens: 300
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('Errore API OpenAI:', errorData);
            return res.status(500).json({ error: 'Errore generazione riassunto' });
        }

        const summaryData = await openaiResponse.json();
        const summary = summaryData.choices[0].message.content;

        console.log('generateContextSummary: Riassunto generato con successo');

        return res.status(200).json({ 
            summary,
            important_facts_count: importantInfo?.length || 0,
            recent_messages_count: recentHistory?.length || 0
        });

    } catch (error) {
        console.error('Errore in generateContextSummary:', error);
        return res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
}
