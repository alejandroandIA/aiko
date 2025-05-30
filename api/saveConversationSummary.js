import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Funzione per generare riassunto con OpenAI
async function generateSummary(conversation) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    const conversationText = conversation.map(msg => 
        `${msg.speaker}: ${msg.content}`
    ).join('\n');
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Sei un assistente che crea riassunti concisi delle conversazioni.
                        Crea un riassunto breve (max 200 parole) che catturi:
                        - I punti chiave discussi
                        - Le emozioni principali espresse
                        - Le informazioni importanti condivise
                        Usa un tono naturale e scrivi in italiano.`
                    },
                    {
                        role: "user",
                        content: `Riassumi questa conversazione:\n\n${conversationText}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Errore generazione riassunto:', error);
        return "Conversazione avvenuta ma riassunto non disponibile.";
    }
}

// Funzione per analizzare sentiment
function analyzeSentiment(conversation) {
    const positiveWords = ['felice', 'contento', 'bene', 'ottimo', 'fantastico', 'perfetto', 'grazie', 'amore'];
    const negativeWords = ['triste', 'male', 'problema', 'difficile', 'stress', 'preoccupato', 'arrabbiato'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    const text = conversation.map(msg => msg.content.toLowerCase()).join(' ');
    
    positiveWords.forEach(word => {
        positiveCount += (text.match(new RegExp(word, 'g')) || []).length;
    });
    
    negativeWords.forEach(word => {
        negativeCount += (text.match(new RegExp(word, 'g')) || []).length;
    });
    
    if (positiveCount > negativeCount * 2) return 'positivo';
    if (negativeCount > positiveCount * 2) return 'negativo';
    if (positiveCount > 0 && negativeCount > 0) return 'misto';
    return 'neutro';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        const { conversation, extracted_info, session_start, session_end } = req.body;
        
        if (!conversation || conversation.length === 0) {
            return res.status(400).json({ error: 'Nessuna conversazione da salvare' });
        }

        // Genera riassunto
        const summary = await generateSummary(conversation);
        
        // Estrai punti chiave dall'extracted_info
        const keyPoints = extracted_info?.important_facts?.map(fact => fact.info) || [];
        
        // Estrai topics e emozioni
        const topics = [...new Set(conversation.flatMap(msg => 
            msg.content.toLowerCase().match(/\b\w{6,}\b/g) || []
        ))].filter(word => 
            !['quando', 'perché', 'come', 'dove', 'cosa', 'questo', 'quello'].includes(word)
        ).slice(0, 10);
        
        const sentiment = analyzeSentiment(conversation);
        
        // Estrai menzioni di persone/luoghi/eventi
        const userMentions = extracted_info?.important_facts?.reduce((acc, fact) => {
            if (['persona', 'luogo', 'data'].includes(fact.type)) {
                if (!acc[fact.type]) acc[fact.type] = [];
                acc[fact.type].push(fact.info);
            }
            return acc;
        }, {}) || {};

        // Salva in conversation_summaries
        const { data, error } = await supabase
            .from('conversation_summaries')
            .insert([{
                summary,
                key_points: keyPoints,
                emotions: [sentiment],
                topics,
                user_mentions: userMentions,
                conversation_date: session_start || new Date(),
                messages_count: conversation.length,
                sentiment
            }]);

        if (error) {
            console.error('Errore Supabase:', error);
            return res.status(500).json({ error: 'Errore salvataggio riassunto' });
        }

        res.status(200).json({ 
            success: true, 
            summary,
            message: 'Riassunto salvato con successo' 
        });
        
    } catch (error) {
        console.error('Errore handler:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
} 