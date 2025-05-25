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
        return res.status(500).json({ error: 'Supabase URL o Key non configurate.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { speaker, content } = req.body;

        if (!speaker || !content) {
            return res.status(400).json({ error: 'Speaker e content sono richiesti.' });
        }

        const { data, error } = await supabase
            .from('memoria_chat')
            .insert([{ speaker, content }]); // created_at e id sono gestiti da Supabase

        if (error) {
            console.error('Errore Supabase (insert):', error);
            return res.status(500).json({ error: 'Errore durante il salvataggio della memoria.', details: error.message });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(201).json({ message: 'Memoria salvata con successo.', entry: data });

    } catch (e) {
        console.error('Errore generico in saveToMemory:', e);
        return res.status(500).json({ error: 'Errore interno del server.', details: e.message });
    }
}
