// api/generateContextSummary.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa GET.' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Configurazione Supabase mancante' });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Recupera informazioni importanti
        const { data: importantInfo, error: infoError } = await supabase
            .from('important_info')
            .select('*')
            .order('created_at', { ascending: false });

        if (infoError) {
            console.error('Errore recupero important_info:', infoError);
        }

        // 2. Recupera riassunti recenti delle conversazioni (ultimi 7 giorni)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: recentSummaries, error: summariesError } = await supabase
            .from('conversation_summaries')
            .select('*')
            .gte('conversation_date', sevenDaysAgo.toISOString())
            .order('conversation_date', { ascending: false })
            .limit(10);

        if (summariesError) {
            console.error('Errore recupero riassunti:', summariesError);
        }

        // 3. Organizza le informazioni importanti per categoria
        const infoByType = {};
        if (importantInfo && importantInfo.length > 0) {
            importantInfo.forEach(info => {
                const type = info.type || 'altro';
                if (!infoByType[type]) infoByType[type] = [];
                infoByType[type].push({
                    info: info.info,
                    context: info.context,
                    confidence: info.confidence
                });
            });
        }

        // 4. Crea il riassunto del contesto
        let contextSummary = "";

        // Aggiungi informazioni importanti
        if (Object.keys(infoByType).length > 0) {
            contextSummary += "INFORMAZIONI IMPORTANTI:\n\n";
            
            const typeLabels = {
                'famiglia': '👨‍👩‍👧‍👦 Famiglia',
                'persona': '👤 Persone importanti',
                'data': '📅 Date importanti',
                'luogo': '📍 Luoghi',
                'preferenza': '❤️ Preferenze',
                'progetto': '💼 Progetti',
                'altro': '📌 Altro'
            };

            for (const [type, infos] of Object.entries(infoByType)) {
                contextSummary += `${typeLabels[type] || type.toUpperCase()}:\n`;
                infos.forEach(info => {
                    contextSummary += `- ${info.info}`;
                    if (info.context) {
                        contextSummary += ` (${info.context})`;
                    }
                    contextSummary += '\n';
                });
                contextSummary += '\n';
            }
        }

        // Aggiungi riassunti recenti
        if (recentSummaries && recentSummaries.length > 0) {
            contextSummary += "\nCONVERSAZIONI RECENTI:\n\n";
            
            recentSummaries.forEach(summary => {
                const date = new Date(summary.conversation_date);
                const dateStr = date.toLocaleDateString('it-IT', { 
                    day: 'numeric', 
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                contextSummary += `📅 ${dateStr}:\n`;
                contextSummary += `${summary.summary}\n`;
                
                if (summary.key_points && summary.key_points.length > 0) {
                    contextSummary += `Punti chiave: ${summary.key_points.join(', ')}\n`;
                }
                
                if (summary.sentiment) {
                    const sentimentEmoji = {
                        'positivo': '😊',
                        'negativo': '😔',
                        'neutro': '😐',
                        'misto': '🤔'
                    };
                    contextSummary += `Mood: ${sentimentEmoji[summary.sentiment] || ''} ${summary.sentiment}\n`;
                }
                
                contextSummary += '\n';
            });
        }

        // Se non ci sono informazioni
        if (!contextSummary) {
            contextSummary = "Non ho ancora informazioni memorizzate. Questa sarà la nostra prima conversazione!";
        }

        res.status(200).json({ 
            summary: contextSummary,
            totalImportantInfo: importantInfo?.length || 0,
            recentConversations: recentSummaries?.length || 0
        });

    } catch (error) {
        console.error('Errore generazione riassunto contesto:', error);
        res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
}
