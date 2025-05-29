-- Schema completo database Aiko con sistema di memoria avanzato

-- Tabella principale per le conversazioni
CREATE TABLE IF NOT EXISTS memoria_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  item_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per le informazioni importanti estratte
CREATE TABLE IF NOT EXISTS important_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('famiglia', 'persona', 'data', 'luogo', 'preferenza', 'progetto', 'altro')),
  info TEXT NOT NULL,
  context TEXT,
  confidence TEXT CHECK (confidence IN ('alta', 'media', 'bassa')) DEFAULT 'media',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nuova tabella per il profilo utente (stile ChatGPT)
CREATE TABLE IF NOT EXISTS user_profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_preferences JSONB,
  conversation_topics JSONB,
  personality_traits TEXT[],
  communication_style JSONB,
  interests TEXT[],
  behavioral_patterns JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nuova tabella per i metadati delle sessioni
CREATE TABLE IF NOT EXISTS session_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  messages_count INTEGER DEFAULT 0,
  topics TEXT[],
  sentiment TEXT CHECK (sentiment IN ('positivo', 'neutro', 'negativo', 'misto')),
  key_insights TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nuova tabella per le preferenze di memoria
CREATE TABLE IF NOT EXISTS memory_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  remember_conversations BOOLEAN DEFAULT true,
  remember_personal_info BOOLEAN DEFAULT true,
  auto_extract_info BOOLEAN DEFAULT true,
  privacy_mode BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per ricerche efficienti
CREATE INDEX IF NOT EXISTS idx_memoria_chat_created_at ON memoria_chat(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_chat_speaker ON memoria_chat(speaker);
CREATE INDEX IF NOT EXISTS idx_memoria_chat_content_search ON memoria_chat USING gin(to_tsvector('italian', content));

CREATE INDEX IF NOT EXISTS idx_important_info_type ON important_info(type);
CREATE INDEX IF NOT EXISTS idx_important_info_created_at ON important_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_important_info_confidence ON important_info(confidence);

CREATE INDEX IF NOT EXISTS idx_session_metadata_session_start ON session_metadata(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_session_metadata_topics ON session_metadata USING gin(topics);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applica il trigger a tutte le tabelle con updated_at
CREATE TRIGGER update_important_info_updated_at
BEFORE UPDATE ON important_info
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profile_updated_at
BEFORE UPDATE ON user_profile
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_preferences_updated_at
BEFORE UPDATE ON memory_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Vista per analisi rapida delle conversazioni recenti
CREATE OR REPLACE VIEW recent_conversations AS
SELECT 
    date_trunc('day', created_at) as conversation_date,
    COUNT(*) as messages_count,
    COUNT(DISTINCT speaker) as participants,
    array_agg(DISTINCT substring(content from 1 for 50)) as sample_messages
FROM memoria_chat
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY date_trunc('day', created_at)
ORDER BY conversation_date DESC;

-- Funzione per pulizia automatica vecchie conversazioni
CREATE OR REPLACE FUNCTION cleanup_old_conversations()
RETURNS void AS $$
DECLARE
    retention_days INTEGER;
BEGIN
    -- Recupera i giorni di retention dalle preferenze
    SELECT COALESCE(mp.retention_days, 90) INTO retention_days
    FROM memory_preferences mp
    LIMIT 1;
    
    -- Elimina conversazioni più vecchie del periodo di retention
    DELETE FROM memoria_chat
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    -- Elimina sessioni metadata vecchie
    DELETE FROM session_metadata
    WHERE session_start < NOW() - INTERVAL '1 day' * retention_days;
END;
$$ LANGUAGE plpgsql; 