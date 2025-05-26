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
        // Log specifico per il server
        console.error('ERRORE FATALE in api/saveToMemory: SUPABASE_URL o SUPABASE_SERVICE_KEY non sono definite nelle variabili d\'ambiente di Vercel.');
        return res.status(500).json({ error: 'Configurazione del server incompleta: Supabase URL o Key non configurate.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        const { speaker, content } = req.body;

        // Validazione più robusta: devono esistere ed essere stringhe non vuote
        if (!speaker || typeof speaker !== 'string' || speaker.trim() === '' ||
            !content || typeof content !== 'string' || content.trim() === '') {
            console.warn('api/saveToMemory: Richiesta con speaker o content mancanti, non stringa, o vuoti. Body ricevuto:', req.body);
            return res.status(400).json({ error: 'I campi speaker e content sono richiesti, devono essere stringhe e non possono essere vuoti.' });
        }

        const { data, error } = await supabase
            .from('memoria_chat')
            .insert([{ speaker: String(speaker).trim(), content: String(content).trim() }]); // Trimma per sicurezza

        if (error) {
            console.error('Errore Supabase (insert) in api/saveToMemory:', error);
            return res.status(500).json({ error: 'Errore durante il salvataggio della memoria.', details: error.message });
        }

        // 'data' dall'insert di Supabase è un array, prendiamo il primo elemento se esiste
        const entrySaved = data && data.length > 0 ? data[0] : null;

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(201).json({ message: 'Memoria salvata con successo.', entry: entrySaved });

    } catch (e) {
        console.error('Errore generico in api/saveToMemory:', e);
        return res.status(500).json({ error: 'Errore interno del server.', details: e.message });
    }
}
