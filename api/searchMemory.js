// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
// import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs'; // File non trovato, uso valori diretti
const USER_NAME = 'Tu';
const AI_NAME = 'Aiko';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { query } = req.query;
    
    if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Query di ricerca mancante' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Configurazione Supabase mancante' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        console.log(`Ricerca memoria per: "${query}"`);
        
        // Prepara termini di ricerca in italiano
        const searchTerms = query.toLowerCase().trim();
        const searchPattern = `%${searchTerms}%`;
        
        // 1. Cerca nelle informazioni importanti (priorità alta)
        const { data: importantResults, error: importantError } = await supabase
            .from('important_info')
            .select('*')
            .or(`info.ilike.${searchPattern},context.ilike.${searchPattern}`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (importantError) {
            console.error('Errore ricerca important_info:', importantError);
        }

        // 2. Cerca nei riassunti delle conversazioni
        const { data: summaryResults, error: summaryError } = await supabase
            .from('conversation_summaries')
            .select('*')
            .or(`summary.ilike.${searchPattern},topics.cs.{${searchTerms}}`)
            .order('conversation_date', { ascending: false })
            .limit(10);

        if (summaryError) {
            console.error('Errore ricerca conversation_summaries:', summaryError);
        }

        // 3. Cerca con text search nei riassunti (fallback)
        let textSearchResults = [];
        if ((!importantResults || importantResults.length === 0) && 
            (!summaryResults || summaryResults.length === 0)) {
            
            const words = searchTerms.split(' ').filter(w => w.length > 2);
            const tsQuery = words.join(' & ');
            
            const { data: tsResults, error: tsError } = await supabase
                .from('conversation_summaries')
                .select('*')
                .textSearch('summary', tsQuery, { 
                    type: 'websearch',
                    config: 'italian' 
                })
                .order('conversation_date', { ascending: false })
                .limit(5);
                
            if (!tsError && tsResults) {
                textSearchResults = tsResults;
            }
        }

        // Combina e formatta i risultati
        let formattedResults = [];
        
        // Aggiungi informazioni importanti
        if (importantResults && importantResults.length > 0) {
            importantResults.forEach(item => {
                const date = new Date(item.created_at);
                formattedResults.push({
                    type: 'important_info',
                    content: `[Info ${item.type}] ${item.info}${item.context ? ` (${item.context})` : ''}`,
                    date: date.toLocaleDateString('it-IT'),
                    relevance: 'alta'
                });
            });
        }
        
        // Aggiungi riassunti conversazioni
        const allSummaries = [...summaryResults || [], ...textSearchResults];
        const uniqueSummaries = Array.from(new Map(allSummaries.map(s => [s.id, s])).values());
        
        uniqueSummaries.forEach(summary => {
            const date = new Date(summary.conversation_date);
            let content = `[Conversazione del ${date.toLocaleDateString('it-IT')}] ${summary.summary}`;
            
            if (summary.key_points && summary.key_points.length > 0) {
                const relevantPoints = summary.key_points.filter(point => 
                    point.toLowerCase().includes(searchTerms)
                );
                if (relevantPoints.length > 0) {
                    content += ` | Punti rilevanti: ${relevantPoints.join(', ')}`;
                }
            }
            
            formattedResults.push({
                type: 'conversation_summary',
                content,
                date: date.toLocaleDateString('it-IT'),
                relevance: 'media'
            });
        });

        // Ordina per rilevanza e data
        formattedResults.sort((a, b) => {
            if (a.relevance !== b.relevance) {
                return a.relevance === 'alta' ? -1 : 1;
            }
            return new Date(b.date) - new Date(a.date);
        });

        // Limita i risultati
        formattedResults = formattedResults.slice(0, 15);

        // Prepara la risposta
        let resultText = "";
        if (formattedResults.length === 0) {
            resultText = `Non ho trovato nulla nei miei ricordi riguardo "${query}".`;
        } else {
            resultText = formattedResults
                .map(r => r.content)
                .join('\n\n');
        }

        console.log(`Trovati ${formattedResults.length} risultati per "${query}"`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ 
            results: resultText,
            count: formattedResults.length,
            query: query
        });

    } catch (error) {
        console.error('Errore searchMemory:', error);
        res.status(500).json({ 
            error: 'Errore nella ricerca',
            details: error.message 
        });
    }
}
