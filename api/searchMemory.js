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

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('ERRORE FATALE api/searchMemory: Variabili ambiente mancanti.');
        return res.status(500).json({ error: 'Configurazione server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const query = req.query.query || req.query.q || '';
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Query di ricerca mancante' });
        }

        console.log('DEBUG api/searchMemory: Searching for term:', query);

        let combinedResults = [];

        // 1. Cerca in memoria_chat
        let { data: chatData, error: chatError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .textSearch('content', query, {
                type: 'websearch',
                config: 'italian' // Manteniamo 'italian' per la chat se è la lingua prevalente
            })
            .order('created_at', { ascending: false })
            .limit(7); // Limite per bilanciare con important_info

        if ((!chatData || chatData.length === 0) && !chatError) {
            ({ data: chatData, error: chatError } = await supabase
                .from('memoria_chat')
                .select('speaker, content, created_at')
                .ilike('content', `%${query}%`)
                .order('created_at', { ascending: false })
                .limit(7));
        }

        if (chatError) {
            console.error('Errore Supabase (select memoria_chat) api/searchMemory:', chatError);
            // Non ritornare subito, potremmo avere risultati da important_info
        } else if (chatData) {
            combinedResults.push(...chatData.map(item => ({
                source: 'chat',
                speaker: item.speaker,
                content: item.content,
                timestamp: item.created_at
            })));
        }

        // 2. Cerca in important_info
        let { data: infoData, error: infoError } = await supabase
            .from('important_info')
            .select('info, type, context, created_at, confidence')
            .textSearch('info', query, { // Assumendo che 'info' sia il campo principale da cercare
                type: 'websearch',
                config: 'simple' // Usiamo 'simple' o 'english' se 'info' può essere multilingue
            })
            .order('created_at', { ascending: false })
            .limit(5); // Limite per i fatti importanti

        if ((!infoData || infoData.length === 0) && !infoError) {
             ({ data: infoData, error: infoError } = await supabase
                .from('important_info')
                .select('info, type, context, created_at, confidence')
                .ilike('info', `%${query}%`)
                .order('created_at', { ascending: false })
                .limit(5));
        }
        
        if (infoError) {
            console.error('Errore Supabase (select important_info) api/searchMemory:', infoError);
        } else if (infoData) {
            combinedResults.push(...infoData.map(item => ({
                source: 'info',
                type: item.type,
                content: item.info,
                context: item.context,
                confidence: item.confidence,
                timestamp: item.created_at
            })));
        }

        if (chatError && infoError && combinedResults.length === 0) {
            return res.status(500).json({ error: 'Errore ricerca memoria in entrambe le tabelle.', details: { chat: chatError?.message, info: infoError?.message } });
        }

        // Ordina i risultati combinati per data (più recenti prima)
        combinedResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Limita il numero totale di risultati combinati, se necessario
        const finalResults = combinedResults.slice(0, 10);

        const formattedResults = finalResults.length > 0
            ? finalResults.map(item => {
                  if (item.source === 'chat') {
                    const speakerLabel = item.speaker === 'Tu' ? USER_NAME : AI_NAME;
                    return `[Conversazione del ${new Date(item.timestamp).toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'})} - ${speakerLabel}]: "${item.content}"`;
                  } else { // source === 'info'
                    return `[Fatto Importante (${item.type}, fiducia: ${item.confidence || 'N/D'}, registrato il ${new Date(item.timestamp).toLocaleDateString('it-IT')} )]: "${item.content}" ${item.context ? '(Contesto: ' + item.context + ')' : ''}`;
                  }
              }).join('\n---\n')
            : `Nessun ricordo o fatto importante trovato per i termini di ricerca: "${query}".`;

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults });

    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
