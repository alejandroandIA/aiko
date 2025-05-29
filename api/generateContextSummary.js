// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';
import { USER_NAME, AI_NAME } from '../src/config/aiConfig.mjs';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !OPENAI_API_KEY) {
        console.error('Variabili d\'ambiente mancanti.');
        return res.status(500).json({ error: 'Configurazione del server incompleta.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Recupera il profilo utente
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profile')
            .select('*')
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.warn('Errore recupero profilo utente:', profileError);
        }

        // 2. Recupera le informazioni importanti
        const { data: importantInfo, error: infoError } = await supabase
            .from('important_info')
            .select('*')
            .order('created_at', { ascending: false });

        if (infoError) {
            console.warn('Errore recupero important_info:', infoError);
        }

        // 3. Recupera le conversazioni recenti (ultime 48 ore)
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
        
        const { data: recentHistory, error: historyError } = await supabase
            .from('memoria_chat')
            .select('speaker, content, created_at')
            .gte('created_at', fortyEightHoursAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(50);

        if (historyError) {
            console.error('Errore recupero cronologia chat:', historyError);
            return res.status(500).json({ error: 'Errore nel recupero della cronologia.' });
        }

        // 4. Prepara il contesto strutturato
        let contextSections = [];

        // Sezione profilo utente (simile a ChatGPT)
        if (userProfile) {
            let profileSection = "PREFERENZE DI RISPOSTA:\n";
            if (userProfile.response_preferences) {
                userProfile.response_preferences.forEach(pref => {
                    profileSection += `• ${pref.preference} (confidenza: ${pref.confidence})\n`;
                });
            }
            
            if (userProfile.communication_style) {
                profileSection += `\nSTILE DI COMUNICAZIONE:\n`;
                profileSection += `• Livello di formalità: ${userProfile.communication_style.formality}\n`;
                profileSection += `• Umorismo: ${userProfile.communication_style.humor}\n`;
                profileSection += `• Livello tecnico: ${userProfile.communication_style.technical_level}\n`;
            }

            if (userProfile.interests && userProfile.interests.length > 0) {
                profileSection += `\nINTERESSI: ${userProfile.interests.join(', ')}\n`;
            }

            contextSections.push(profileSection);
        }

        // Sezione informazioni importanti
        if (importantInfo && importantInfo.length > 0) {
            let infoSection = "FATTI IMPORTANTI DA RICORDARE:\n";
            
            const grouped = {};
            importantInfo.forEach(item => {
                if (!grouped[item.type]) grouped[item.type] = [];
                grouped[item.type].push(item);
            });

            for (const [type, items] of Object.entries(grouped)) {
                infoSection += `\n${type.toUpperCase()}:\n`;
                items.forEach(item => {
                    infoSection += `• ${item.info}`;
                    if (item.context) infoSection += ` (${item.context})`;
                    if (item.confidence !== 'alta') infoSection += ` [confidenza: ${item.confidence}]`;
                    infoSection += '\n';
                });
            }
            
            contextSections.push(infoSection);
        }

        // Sezione conversazioni recenti
        let recentSection = "";
        if (recentHistory && recentHistory.length > 0) {
            recentSection = "ARGOMENTI RECENTI:\n";
            const topics = new Set();
            recentHistory.forEach(msg => {
                // Estrai argomenti principali dalle conversazioni
                if (msg.content.length > 20) {
                    const words = msg.content.toLowerCase().split(/\s+/);
                    words.forEach(word => {
                        if (word.length > 5 && !['quando', 'perché', 'come', 'dove', 'cosa'].includes(word)) {
                            topics.add(word);
                        }
                    });
                }
            });
            if (topics.size > 0) {
                recentSection += Array.from(topics).slice(0, 10).join(', ') + '\n';
            }
        }

        if (recentSection) contextSections.push(recentSection);

        // Se non c'è alcun contesto
        if (contextSections.length === 0) {
            return res.status(200).json({ 
                summary: "Non ci sono conversazioni precedenti o informazioni salvate. Questa è la nostra prima conversazione!",
                profile_exists: false,
                important_facts_count: 0,
                recent_messages_count: 0
            });
        }

        // 5. Genera il riassunto finale con GPT
        const contextText = contextSections.join('\n---\n\n');
        
        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${OPENAI_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Sei ${AI_NAME}. Genera un riassunto conciso per iniziare la conversazione con ${USER_NAME}.

IMPORTANTE:
- Scrivi in PRIMA PERSONA come se fossi tu che ricordi
- Menziona solo i fatti più rilevanti
- Sii naturale e amichevole
- Se ci sono preferenze di comunicazione, tienine conto nel tono
- Massimo 150 parole`
                    },
                    {
                        role: "user",
                        content: contextText
                    }
                ],
                temperature: 0.4,
                max_tokens: 250
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('Errore API OpenAI:', errorData);
            return res.status(500).json({ error: 'Errore generazione riassunto' });
        }

        const summaryData = await openaiResponse.json();
        const summary = summaryData.choices[0].message.content;

        console.log('generateContextSummary: Riassunto generato con profilo utente');

        return res.status(200).json({ 
            summary,
            profile_exists: !!userProfile,
            important_facts_count: importantInfo?.length || 0,
            recent_messages_count: recentHistory?.length || 0
        });

    } catch (error) {
        console.error('Errore in generateContextSummary:', error);
        return res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
}
