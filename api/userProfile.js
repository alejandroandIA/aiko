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
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseKey || !OPENAI_API_KEY) {
        return res.status(500).json({ error: 'Configurazione server incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        if (req.method === 'GET') {
            // Recupera il profilo utente esistente
            const { data: profile, error } = await supabase
                .from('user_profile')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                throw error;
            }

            return res.status(200).json({ profile: profile || null });
        }

        if (req.method === 'POST') {
            // Analizza le conversazioni e genera/aggiorna il profilo
            const { data: conversations, error: convError } = await supabase
                .from('memoria_chat')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (convError) throw convError;

            if (!conversations || conversations.length === 0) {
                return res.status(200).json({ 
                    message: 'Nessuna conversazione da analizzare',
                    profile: null 
                });
            }

            // Prepara il testo per l'analisi
            const conversationText = conversations
                .map(c => `${c.speaker}: ${c.content}`)
                .join('\n');

            // Usa GPT per analizzare i pattern
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: `Analizza le conversazioni e crea un profilo utente dettagliato.

Output JSON richiesto:
{
  "response_preferences": [
    {
      "preference": "descrizione preferenza",
      "confidence": "alta|media|bassa",
      "examples": ["esempio 1", "esempio 2"]
    }
  ],
  "conversation_topics": [
    {
      "topic": "argomento",
      "frequency": "alta|media|bassa",
      "sentiment": "positivo|neutro|negativo",
      "last_mentioned": "data approssimativa"
    }
  ],
  "personality_traits": [
    "tratto 1",
    "tratto 2"
  ],
  "communication_style": {
    "formality": "formale|informale|misto",
    "humor": "presente|assente",
    "technical_level": "alto|medio|basso"
  },
  "interests": ["interesse 1", "interesse 2"],
  "behavioral_patterns": [
    {
      "pattern": "descrizione pattern",
      "frequency": "sempre|spesso|a volte"
    }
  ]
}`
                    }, {
                        role: 'user',
                        content: conversationText
                    }],
                    temperature: 0.3,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI error: ${JSON.stringify(error)}`);
            }

            const data = await response.json();
            const profile = JSON.parse(data.choices[0].message.content);

            // Controlla se esiste già un profilo
            const { data: existing } = await supabase
                .from('user_profile')
                .select('id')
                .single();

            if (existing) {
                // Aggiorna
                const { error: updateError } = await supabase
                    .from('user_profile')
                    .update({
                        ...profile,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Inserisci nuovo
                const { error: insertError } = await supabase
                    .from('user_profile')
                    .insert([profile]);

                if (insertError) throw insertError;
            }

            return res.status(200).json({ 
                message: 'Profilo aggiornato',
                profile 
            });
        }

        res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
        return res.status(405).json({ error: `Metodo ${req.method} non permesso` });

    } catch (error) {
        console.error('Errore in userProfile:', error);
        return res.status(500).json({ 
            error: 'Errore gestione profilo',
            details: error.message 
        });
    }
} 