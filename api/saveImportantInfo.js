import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurazione Supabase mancante' });
    }

    try {
        const { type, info, context, confidence } = req.body;

        if (!type || !info) {
            return res.status(400).json({ error: 'Dati mancanti' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Prima verifica se l'informazione esiste già
        const { data: existing } = await supabase
            .from('important_info')
            .select('*')
            .eq('info', info)
            .single();

        if (existing) {
            // Aggiorna se già esiste
            const { error } = await supabase
                .from('important_info')
                .update({ 
                    context, 
                    confidence,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) throw error;
            return res.status(200).json({ message: 'Informazione aggiornata' });
        }

        // Altrimenti inserisci nuova
        const { error } = await supabase
            .from('important_info')
            .insert([{ type, info, context, confidence }]);

        if (error) throw error;

        return res.status(201).json({ message: 'Informazione salvata' });

    } catch (error) {
        console.error('Errore in saveImportantInfo:', error);
        return res.status(500).json({ 
            error: 'Errore salvataggio informazione',
            details: error.message 
        });
    }
} 