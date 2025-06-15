const { createClient } = require('@supabase/supabase-js');

// Funzione per impostare gli header CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { userId, durationSeconds, model } = req.body;

    if (!userId || !durationSeconds || !model) {
        return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        const today = new Date().toISOString().split('T')[0];
        const minutesUsed = Math.ceil(durationSeconds / 60);

        // Ottieni o crea record per oggi
        let { data: timeTracking, error: fetchError } = await supabase
            .from('user_time_tracking')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        if (fetchError && fetchError.code === 'PGRST116') {
            // Non esiste, crealo
            const { data: newTracking, error: createError } = await supabase
                .from('user_time_tracking')
                .insert({
                    user_id: userId,
                    date: today,
                    premium_minutes_used: 0,
                    standard_minutes_used: 0
                })
                .select()
                .single();

            if (createError) throw createError;
            timeTracking = newTracking;
        } else if (fetchError) {
            throw fetchError;
        }

        // Aggiorna minuti usati
        const isPremium = model === 'gpt-4o';
        const updateData = isPremium
            ? { premium_minutes_used: timeTracking.premium_minutes_used + minutesUsed }
            : { standard_minutes_used: timeTracking.standard_minutes_used + minutesUsed };

        updateData.last_session_end = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('user_time_tracking')
            .update(updateData)
            .eq('id', timeTracking.id);

        if (updateError) throw updateError;

        // Salva sessione di conversazione
        await supabase
            .from('conversation_sessions')
            .insert({
                user_id: userId,
                ai_character: req.body.aiCharacter || 'aiko',
                session_end: new Date().toISOString(),
                model_used: model,
                duration_seconds: durationSeconds
            });

        // Ottieni tempo aggiornato
        const { data: timeInfo } = await supabase
            .rpc('get_user_remaining_time', { p_user_id: userId });

        return res.status(200).json({
            success: true,
            timeInfo: timeInfo[0]
        });

    } catch (error) {
        console.error('Errore aggiornamento tempo:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 