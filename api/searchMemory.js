// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
// Non importiamo più USER_NAME, AI_NAME da aiConfig qui,
// l'IA userà i risultati grezzi e le sue istruzioni per interpretarli.

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
        const { query } = req.query;
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return res.status(400).json({ error: 'Parametro query richiesto e non vuoto.' });
        }
        const searchTerm = String(query).trim();

        // Recupera più risultati, l'IA filtrerà/sintetizzerà
        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at') // Includi speaker per contesto
            .ilike('content', `%${searchTerm}%`)
            .order('created_at', { ascending: false }) // I più recenti sono spesso più rilevanti
            .limit(15); // Aumentato a 15 per fornire più dati grezzi all'IA

        if (error) {
            console.error('Errore Supabase (select) api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore ricerca memoria.', details: error.message });
        }

        // Restituisci i dati più grezzi possibile, l'IA è brava a processarli se istruita bene.
        // Formattiamo solo per renderlo leggibile come "ricordo".
        const formattedResults = data && data.length > 0
            ? data.map(item => `[Ricordo del ${new Date(item.created_at).toLocaleDateString('it-IT')} - Parlante: ${item.speaker === 'Tu' ? 'Alejandro' : 'Aiko'}]: "${item.content}"`).join('\n---\n')
            : `Nessun ricordo trovato per i termini di ricerca: "${searchTerm}".`;

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults });

    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
