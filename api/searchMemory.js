// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.js'; // <<<< PERCORSO CORRETTO


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
        console.error('ERRORE FATALE api/searchMemory: SUPABASE_URL o SUPABASE_SERVICE_KEY non definite.');
        return res.status(500).json({ error: 'Configurazione server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string' || query.trim() === '') {
            console.warn('api/searchMemory: Query mancante/vuota. Query:', query);
            return res.status(400).json({ error: 'Parametro query richiesto e non vuoto.' });
        }
        const searchTerm = String(query).trim();
        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .ilike('content', `%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Errore Supabase (select) api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore ricerca memoria.', details: error.message });
        }
        const formattedResults = data.map(item => {
            const speakerLabel = item.speaker === 'Tu' ? USER_NAME : AI_NAME;
            return `${speakerLabel} (il ${new Date(item.created_at).toLocaleDateString('it-IT')} ${new Date(item.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}): ${item.content}`;
        }).join('\n---\n');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults || "Nessun ricordo trovato per quei termini." });
    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
