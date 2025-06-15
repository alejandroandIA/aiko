// api/searchMemory.js
// Questo file gestisce la ricerca nella memoria dell'IA (Aiko).
// Cerca informazioni in due tabelle Supabase: 'important_info' e 'conversation_summaries'.
// Se la ricerca testuale non produce risultati, utilizza gli embedding di OpenAI 
// per trovare corrispondenze semantiche nei riassunti delle conversazioni.
// Combina e restituisce tutti i risultati trovati.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
// import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs'; // File non trovato, uso valori diretti
const USER_NAME = 'Tu';
const AI_NAME = 'Aiko';

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

    const { searchTerms, userId, aiCharacter } = req.body;

    if (!searchTerms || !userId) {
        return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        console.log(`Ricerca memoria per utente ${userId}: "${searchTerms}"`);

        // 1. Ricerca nelle informazioni importanti dell'utente
        const { data: importantInfo, error: infoError } = await supabase
            .from('important_info')
            .select('*')
            .eq('user_id', userId)
            .textSearch('info', searchTerms, { type: 'websearch', config: 'italian' })
            .limit(10);

        if (infoError) console.error('Errore ricerca important_info:', infoError);

        // 2. Ricerca nei riassunti delle conversazioni
        const { data: summaries, error: summariesError } = await supabase
            .from('conversation_summaries')
            .select('*')
            .eq('user_id', userId)
            .eq('ai_character', aiCharacter)
            .or(`summary.ilike.%${searchTerms}%,key_points.cs.{${searchTerms}}`)
            .order('conversation_date', { ascending: false })
            .limit(5);

        if (summariesError) console.error('Errore ricerca summaries:', summariesError);

        // 3. Ricerca con embedding se non ci sono risultati diretti
        let embeddingResults = [];
        if ((!importantInfo || importantInfo.length === 0) && (!summaries || summaries.length === 0)) {
            try {
                // Genera embedding per la query
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-ada-002",
                    input: searchTerms,
                });
                
                const queryEmbedding = embeddingResponse.data[0].embedding;
                
                // Cerca per similarità nei riassunti
                const { data: semanticResults } = await supabase.rpc(
                    'search_conversation_summaries_by_embedding',
                    {
                        query_embedding: queryEmbedding,
                        match_threshold: 0.7,
                        match_count: 5,
                        p_user_id: userId,
                        p_ai_character: aiCharacter
                    }
                );
                
                embeddingResults = semanticResults || [];
            } catch (embError) {
                console.error('Errore ricerca embedding:', embError);
            }
        }

        // 4. Combina e formatta i risultati
        const results = [];

        // Aggiungi informazioni importanti
        if (importantInfo && importantInfo.length > 0) {
            importantInfo.forEach(info => {
                results.push({
                    type: 'important_info',
                    content: info.info,
                    context: info.context,
                    category: info.type,
                    confidence: info.confidence,
                    date: info.created_at
                });
            });
        }

        // Aggiungi riassunti conversazioni
        if (summaries && summaries.length > 0) {
            summaries.forEach(summary => {
                results.push({
                    type: 'conversation',
                    content: summary.summary,
                    key_points: summary.key_points,
                    topics: summary.topics,
                    date: summary.conversation_date,
                    sentiment: summary.sentiment
                });
            });
        }

        // Aggiungi risultati embedding
        embeddingResults.forEach(result => {
            results.push({
                type: 'semantic_match',
                content: result.summary,
                similarity: result.similarity,
                date: result.conversation_date
            });
        });

        // Se non ci sono risultati
        if (results.length === 0) {
            results.push({
                type: 'no_results',
                content: 'Non ho trovato ricordi specifici su questo argomento.'
            });
        }

        return res.status(200).json({ 
            results,
            query: searchTerms,
            totalResults: results.length
        });

    } catch (error) {
        console.error('Errore ricerca memoria:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}
