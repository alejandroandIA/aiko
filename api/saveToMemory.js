// api/saveToMemory.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('ERRORE FATALE in api/saveToMemory: SUPABASE_URL o SUPABASE_SERVICE_KEY non definite.');
        return res.status(500).json({ error: 'Configurazione server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { speaker, content } = req.body;

        // Validazione base
        if (!speaker || !content) {
            console.warn('api/saveToMemory: Dati mancanti. Speaker:', speaker, 'Content:', content ? content.substring(0, 50) : 'null');
            return res.status(400).json({ error: 'Dati mancanti' });
        }

        const { data, error } = await supabase
            .from('memoria_chat')
            .insert([
                { speaker, content }
            ]);

        if (error) {
            console.error('Errore Supabase (insert) api/saveToMemory:', error);
            return res.status(500).json({ error: 'Errore salvataggio memoria.', details: error.message });
        }
        const entrySaved = data && data.length > 0 ? data[0] : null;
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(201).json({ message: 'Memoria salvata.', entry: entrySaved });
    } catch (e) {
        console.error('Errore generico api/saveToMemory:', e);
        return res.status(500).json({ error: 'Errore interno server.', details: e.message });
    }
}
