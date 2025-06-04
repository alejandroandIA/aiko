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

    const { importantInfo, userId } = req.body;

    if (!importantInfo || !userId || !Array.isArray(importantInfo)) {
        return res.status(400).json({ error: 'Dati non validi' });
    }

    if (importantInfo.length === 0) {
        return res.status(200).json({ success: true, message: 'Nessuna informazione da salvare' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Prepara i dati per l'inserimento
        const dataToInsert = importantInfo.map(info => ({
            user_id: userId,
            type: info.type || 'altro',
            info: info.info,
            context: info.context || null,
            confidence: info.confidence || 'media'
        }));

        // Inserisci in batch
        const { data, error } = await supabase
            .from('important_info')
            .insert(dataToInsert)
            .select();

        if (error) throw error;

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ 
            success: true, 
            saved: data.length,
            message: `${data.length} informazioni salvate con successo`
        });

    } catch (error) {
        console.error('Errore salvataggio important_info:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 