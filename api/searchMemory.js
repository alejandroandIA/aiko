// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.js'; // Assicurati che il percorso sia corretto

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        // ... (OPTIONS handling come prima) ...
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
            return res.status(400).json({ error: 'Parametro query richiesto e non vuoto.' });
        }
        const searchTerm = String(query).trim();
        // Aumentiamo leggermente il limite per dare più contesto se necessario
        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .ilike('content', `%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(7); // Un po' più di contesto dai risultati

        if (error) {
            console.error('Errore Supabase (select) api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore ricerca memoria.', details: error.message });
        }

        // Formattazione pensata per essere letta dall'IA come contesto
        const formattedResults = data.map(item => {
            const speakerLabel = item.speaker === 'Tu' ? `${USER_NAME} (utente)` : `${AI_NAME} (tu, IA)`;
            // Format più conciso per l'IA
            return `[Memoria del ${new Date(item.created_at).toLocaleDateString('it-IT')} - ${speakerLabel}]: "${item.content}"`;
        }).join('\n');

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ results: formattedResults || `Nessun ricordo trovato per "${searchTerm}".` });

    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
