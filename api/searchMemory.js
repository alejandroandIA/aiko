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
        // Log specifico per il server
        console.error('ERRORE FATALE in api/searchMemory: SUPABASE_URL o SUPABASE_SERVICE_KEY non sono definite nelle variabili d\'ambiente di Vercel.');
        return res.status(500).json({ error: 'Configurazione del server incompleta: Supabase URL o Key non configurate.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { query } = req.query;

        if (!query || typeof query !== 'string' || query.trim() === '') {
            console.warn('api/searchMemory: Richiesta con parametro query mancante, non stringa, o vuoto. Query ricevuta:', query);
            return res.status(400).json({ error: 'Il parametro query di ricerca è richiesto, deve essere una stringa e non può essere vuoto.' });
        }

        const searchTerm = String(query).trim();

        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .ilike('content', `%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Errore Supabase (select) in api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore durante la ricerca nella memoria.', details: error.message });
        }
        
        const formattedResults = data.map(item => `${item.speaker} (il ${new Date(item.created_at).toLocaleDateString('it-IT')}): ${item.content}`).join('\n---\n');

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults || "Nessun ricordo trovato per quei termini." });

    } catch (e) {
        console.error('Errore generico in api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno del server.', details: e.message });
    }
}
