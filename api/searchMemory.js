import { createClient } from '@supabase/supabase-js';

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
        return res.status(500).json({ error: 'Supabase URL o Key non configurate.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { query } = req.query; // Riceve i termini di ricerca come query parameter

        if (!query) {
            return res.status(400).json({ error: 'Query di ricerca richiesta.' });
        }

        // Ricerca testuale semplice (PostgreSQL LIKE). 
        // Per ricerche più avanzate, potresti usare la ricerca full-text di PostgreSQL (tsvector).
        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .ilike('content', `%${query}%`) // Case-insensitive LIKE
            .order('created_at', { ascending: false }) // Più recenti prima
            .limit(5); // Restituisce al massimo 5 risultati rilevanti

        if (error) {
            console.error('Errore Supabase (select):', error);
            return res.status(500).json({ error: 'Errore durante la ricerca nella memoria.', details: error.message });
        }
        
        const formattedResults = data.map(item => `${item.speaker} (il ${new Date(item.created_at).toLocaleDateString('it-IT')}): ${item.content}`).join('\n---\n');

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults || "Nessun ricordo trovato per quei termini." });

    } catch (e) {
        console.error('Errore generico in searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno del server.', details: e.message });
    }
}
