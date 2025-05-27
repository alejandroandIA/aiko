// api/searchMemory.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.js';

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
            return res.status(400).json({ error: 'Parametro query richiesto e non vuoto.' });
        }
        const searchTerm = String(query).trim();
        const { data, error } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .ilike('content', `%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(5); // Ridotto a 5 per output più conciso all'IA

        if (error) {
            console.error('Errore Supabase (select) api/searchMemory:', error);
            return res.status(500).json({ error: 'Errore ricerca memoria.', details: error.message });
        }

        // MODIFICA: Restituisci un array di oggetti invece di una singola stringa formattata
        // L'IA dovrà poi processare questo array.
        const resultsArray = data.map(item => ({
            speaker: item.speaker === 'Tu' ? USER_NAME : AI_NAME,
            timestamp: new Date(item.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }),
            content: item.content
        }));

        // Per l'IA, potrebbe essere meglio una stringa, ma assicuriamoci che sia ben formattata.
        // Oppure, l'IA può essere istruita a gestire un array di risultati.
        // Per ora, proviamo con una stringa, ma con una formattazione più semplice e robusta.
        let formattedResultsForAI = "Nessun ricordo trovato per quei termini.";
        if (data && data.length > 0) {
            formattedResultsForAI = data.map(item => {
                const speakerLabel = item.speaker === 'Tu' ? USER_NAME : AI_NAME;
                // Semplifichiamo la stringa per ridurre rischi di caratteri problematici
                return `[${new Date(item.created_at).toLocaleDateString('it-IT')}] ${speakerLabel}: ${item.content.replace(/"/g, "'").substring(0, 200)}${item.content.length > 200 ? '...' : ''}`;
            }).join('\n---\n');
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        // Invia la stringa formattata, sperando che la pulizia aiuti
        return res.status(200).json({ results: formattedResultsForAI });

    } catch (e) {
        console.error('Errore generico api/searchMemory:', e);
        // In caso di errore qui, assicurati di restituire un JSON valido
        return res.status(500).json({ error: 'Errore interno server durante la ricerca.', details: e.message });
    }
}
