const { createClient } = require('@supabase/supabase-js');

// Funzione per impostare gli header CORS
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET', 'OPTIONS']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurazione Supabase mancante' });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('important_info')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Raggruppa per tipo
        const groupedInfo = {
            famiglia: [],
            persona: [],
            data: [],
            luogo: [],
            preferenza: [],
            progetto: [],
            altro: []
        };

        data.forEach(item => {
            if (groupedInfo[item.type]) {
                groupedInfo[item.type].push({
                    info: item.info,
                    context: item.context,
                    confidence: item.confidence
                });
            }
        });

        // Crea un riassunto testuale
        let summary = "Informazioni importanti:\n";
        
        if (groupedInfo.famiglia.length > 0) {
            summary += "\nFAMIGLIA:\n";
            groupedInfo.famiglia.forEach(item => {
                summary += `- ${item.info}${item.context ? ` (${item.context})` : ''}\n`;
            });
        }

        if (groupedInfo.persona.length > 0) {
            summary += "\nPERSONE:\n";
            groupedInfo.persona.forEach(item => {
                summary += `- ${item.info}${item.context ? ` (${item.context})` : ''}\n`;
            });
        }

        if (groupedInfo.preferenza.length > 0) {
            summary += "\nPREFERENZE:\n";
            groupedInfo.preferenza.forEach(item => {
                summary += `- ${item.info}\n`;
            });
        }

        if (groupedInfo.progetto.length > 0) {
            summary += "\nPROGETTI:\n";
            groupedInfo.progetto.forEach(item => {
                summary += `- ${item.info}\n`;
            });
        }

        return res.status(200).json({
            important_info: groupedInfo,
            summary: summary,
            total_facts: data.length
        });

    } catch (error) {
        console.error('Errore in getImportantInfo:', error);
        return res.status(500).json({ 
            error: 'Errore recupero informazioni',
            details: error.message 
        });
    }
} 