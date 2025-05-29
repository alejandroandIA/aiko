import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // CORS headers
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
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
        switch (req.method) {
            case 'GET':
                // Ottieni tutte le memorie dell'utente
                const { type } = req.query;
                
                let query = supabase.from('important_info').select('*');
                
                if (type) {
                    query = query.eq('type', type);
                }
                
                const { data: memories, error: getError } = await query.order('created_at', { ascending: false });
                
                if (getError) throw getError;
                
                // Aggiungi anche un riassunto delle conversazioni recenti
                const { data: recentChats, error: chatError } = await supabase
                    .from('memoria_chat')
                    .select('speaker, content, created_at')
                    .order('created_at', { ascending: false })
                    .limit(20);
                
                if (chatError) console.warn('Errore recupero chat recenti:', chatError);
                
                return res.status(200).json({
                    memories: memories || [],
                    recent_conversations: recentChats || [],
                    total_memories: memories?.length || 0
                });
                
            case 'POST':
                // Aggiungi o aggiorna una memoria
                const { id, type: memType, info, context, confidence } = req.body;
                
                if (id) {
                    // Aggiorna memoria esistente
                    const { error: updateError } = await supabase
                        .from('important_info')
                        .update({ type: memType, info, context, confidence })
                        .eq('id', id);
                    
                    if (updateError) throw updateError;
                    
                    return res.status(200).json({ message: 'Memoria aggiornata' });
                } else {
                    // Crea nuova memoria
                    const { error: insertError } = await supabase
                        .from('important_info')
                        .insert([{ type: memType, info, context, confidence }]);
                    
                    if (insertError) throw insertError;
                    
                    return res.status(201).json({ message: 'Memoria creata' });
                }
                
            case 'DELETE':
                // Elimina una memoria specifica o tutte
                const { memoryId, deleteAll } = req.body;
                
                if (deleteAll) {
                    // Elimina tutte le memorie
                    const { error: deleteAllError } = await supabase
                        .from('important_info')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000'); // Trucco per eliminare tutti
                    
                    if (deleteAllError) throw deleteAllError;
                    
                    return res.status(200).json({ message: 'Tutte le memorie eliminate' });
                } else if (memoryId) {
                    // Elimina memoria specifica
                    const { error: deleteError } = await supabase
                        .from('important_info')
                        .delete()
                        .eq('id', memoryId);
                    
                    if (deleteError) throw deleteError;
                    
                    return res.status(200).json({ message: 'Memoria eliminata' });
                } else {
                    return res.status(400).json({ error: 'ID memoria mancante' });
                }
                
            default:
                res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'OPTIONS']);
                return res.status(405).json({ error: `Metodo ${req.method} non permesso` });
        }
    } catch (error) {
        console.error('Errore in manageMemory:', error);
        return res.status(500).json({ 
            error: 'Errore gestione memoria',
            details: error.message 
        });
    }
} 