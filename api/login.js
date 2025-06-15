import { createClient } from '@supabase/supabase-js';

// Funzione per impostare gli header CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // In produzione, restringere a VERCEL_URL
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { nome, cognome } = req.body;

    if (!nome || !cognome) {
        return res.status(400).json({ error: 'Nome e cognome sono richiesti' });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Cerca o crea l'utente
        let { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('nome', nome)
            .eq('cognome', cognome)
            .single();

        if (userError && userError.code === 'PGRST116') {
            // Utente non esiste, crealo
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({ nome, cognome })
                .select()
                .single();

            if (createError) throw createError;
            user = newUser;
        } else if (userError) {
            throw userError;
        } else {
            // Aggiorna last_login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id);
        }

        // Ottieni info tempo utente
        const { data: timeInfo } = await supabase
            .rpc('get_user_remaining_time', { p_user_id: user.id });

        return res.status(200).json({
            user,
            timeInfo: timeInfo[0] || {
                premium_minutes_remaining: 10,
                standard_minutes_remaining: 10,
                can_use_premium: true,
                can_use_standard: true
            }
        });

    } catch (error) {
        console.error('Errore login:', error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
} 