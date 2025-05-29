// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs';

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

        let { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .textSearch('content', query, {
                type: 'websearch',
                config: 'italian'
            })
            .order('created_at', { ascending: false })
            .limit(10);

        // Se la ricerca testuale non trova nulla, prova con ILIKE per maggiore flessibilità
        if ((!data || data.length === 0) && !error) {
            ({ data, error } = await supabase
                .from('memoria_chat')
                .select('speaker, content, created_at')
                .ilike('content', `%${query}%`)
                .order('created_at', { ascending: false })
                .limit(10));
        }

        if (error) {
            console.error('Errore Supabase (select) api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore ricerca memoria.', details: error.message });
        }

        const formattedResults = data && data.length > 0
            ? data.map(item => {
                  const speakerLabel = item.speaker === 'Tu' ? USER_NAME : AI_NAME;
                  // Format più conciso per l'IA, include data e ora
                  return `[Memoria del ${new Date(item.created_at).toLocaleString('it-IT', {dateStyle: 'short', timeStyle: 'short'})} - ${speakerLabel}]: "${item.content}"`;
              }).join('\n---\n')
            : `Nessun ricordo trovato per i termini di ricerca: "${query}".`;

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults });

    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
