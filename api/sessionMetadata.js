import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurazione server incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        if (req.method === 'GET') {
            // Recupera i metadati delle sessioni recenti
            const { limit = 10 } = req.query;
            
            const { data, error } = await supabase
                .from('session_metadata')
                .select('*')
                .order('session_start', { ascending: false })
                .limit(parseInt(limit));

            if (error) throw error;

            return res.status(200).json({ sessions: data || [] });
        }

        if (req.method === 'POST') {
            // Salva i metadati di una nuova sessione
            const {
                session_start,
                session_end,
                messages_count,
                topics,
                sentiment,
                key_insights
            } = req.body;

            // Validazione base
            if (!session_start || !messages_count) {
                return res.status(400).json({ 
                    error: 'Dati sessione mancanti' 
                });
            }

            const { error } = await supabase
                .from('session_metadata')
                .insert([{
                    session_start,
                    session_end,
                    messages_count,
                    topics: topics || [],
                    sentiment: sentiment || 'neutro',
                    key_insights: key_insights || null
                }]);

            if (error) throw error;

            return res.status(201).json({ 
                message: 'Metadati sessione salvati' 
            });
        }

        res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
        return res.status(405).json({ 
            error: `Metodo ${req.method} non permesso` 
        });

    } catch (error) {
        console.error('Errore in sessionMetadata:', error);
        return res.status(500).json({ 
            error: 'Errore gestione metadati sessione',
            details: error.message 
        });
    }
} 