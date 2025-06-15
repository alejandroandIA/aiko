// api/saveConversationSummary.js
// Questo file gestisce il salvataggio dei riassunti delle conversazioni al termine di ogni chat.
// Processo:
// 1. Riceve la conversazione completa, userId e aiCharacter dal frontend
// 2. Usa GPT-4 per analizzare la conversazione ed estrarre:
//    - Riassunto conciso (max 150 parole)
//    - Punti chiave discussi
//    - Emozioni prevalenti
//    - Topics/argomenti
//    - Persone/luoghi/eventi menzionati
//    - Sentiment generale
// 3. Salva il riassunto nella tabella 'conversation_summaries' di Supabase
// 4. Pulisce le conversazioni temporanee più vecchie di 48 ore
// Questo permette all'AI di ricordare le conversazioni passate senza salvare tutto il testo

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Funzione per impostare gli header CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

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
                model: "gpt-4o",
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
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { conversation, userId, aiCharacter } = req.body;

    if (!conversation || !userId || !aiCharacter) {
        return res.status(400).json({ error: 'Dati mancanti' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // Formatta la conversazione per il riassunto
        const conversationText = conversation.map(msg => 
            `${msg.speaker}: ${msg.content}`
        ).join('\n');

        // Genera riassunto con GPT-4
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Sei un assistente che crea riassunti concisi di conversazioni. 
                    Estrai:
                    1. Un riassunto breve della conversazione (max 150 parole)
                    2. Punti chiave discussi (array di stringhe)
                    3. Emozioni prevalenti (array di stringhe)
                    4. Topics/argomenti principali (array di stringhe)
                    5. Persone, luoghi o eventi menzionati
                    6. Sentiment generale (positivo/neutro/negativo/misto)
                    
                    Rispondi SOLO in formato JSON valido.`
                },
                {
                    role: "user",
                    content: `Analizza questa conversazione:\n\n${conversationText}`
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content);

        // Salva il riassunto nel database
        const { data, error } = await supabase
            .from('conversation_summaries')
            .insert({
                user_id: userId,
                ai_character: aiCharacter,
                summary: analysis.summary || '',
                key_points: analysis.key_points || [],
                emotions: analysis.emotions || [],
                topics: analysis.topics || [],
                user_mentions: analysis.mentions || {},
                messages_count: conversation.length,
                sentiment: analysis.sentiment || 'neutro',
                conversation_date: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Pulisci conversazioni temporanee vecchie
        await supabase
            .from('memoria_chat')
            .delete()
            .eq('user_id', userId)
            .lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

        return res.status(200).json({ 
            success: true, 
            summaryId: data.id,
            summary: analysis.summary
        });

    } catch (error) {
        console.error('Errore salvataggio riassunto:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 