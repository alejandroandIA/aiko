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

    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID richiesto' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Ottieni tempo rimanente
        const { data: timeInfo, error } = await supabase
            .rpc('get_user_remaining_time', { p_user_id: userId });

        if (error) throw error;

        const info = timeInfo[0] || {
            premium_minutes_remaining: 0,
            standard_minutes_remaining: 0,
            can_use_premium: false,
            can_use_standard: false,
            next_reset: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(info);

    } catch (error) {
        console.error('Errore verifica tempo:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 