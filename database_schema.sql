-- Schema completo database Aiko con sistema di memoria avanzato

-- NUOVA TABELLA: Riassunti delle conversazioni invece di conversazioni complete
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  summary TEXT NOT NULL,
  key_points TEXT[],
  emotions TEXT[],
  topics TEXT[],
  user_mentions JSONB,  -- Persone/luoghi/eventi menzionati dall'utente
  conversation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  messages_count INTEGER DEFAULT 0,
  sentiment TEXT CHECK (sentiment IN ('positivo', 'neutro', 'negativo', 'misto')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella memoria_chat ora solo per conversazione corrente/recente (non storico completo)
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

-- Nuovi indici per conversation_summaries
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_date ON conversation_summaries(conversation_date DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_topics ON conversation_summaries USING gin(topics);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_summary ON conversation_summaries USING gin(to_tsvector('italian', summary));

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

-- Nuova funzione per pulizia automatica memoria_chat (mantiene solo ultime 48 ore)
CREATE OR REPLACE FUNCTION cleanup_temporary_chat()
RETURNS void AS $$
BEGIN
    -- Mantiene solo le ultime 48 ore nella memoria_chat
    DELETE FROM memoria_chat
    WHERE created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- Schema database CI SONO IO - Sistema di memoria avanzato con gestione utenti

-- Tabella utenti
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (nome || ' ' || cognome) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(nome, cognome)
);

-- Tabella per tracciare il tempo di utilizzo degli utenti
CREATE TABLE IF NOT EXISTS user_time_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  premium_minutes_used INTEGER DEFAULT 0, -- minuti usati con gpt-4o-realtime
  standard_minutes_used INTEGER DEFAULT 0, -- minuti usati con gpt-4o-mini-realtime  
  last_session_start TIMESTAMP WITH TIME ZONE,
  last_session_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Tabella per le sessioni di conversazione
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_character TEXT NOT NULL CHECK (ai_character IN ('aiko', 'francesca', 'amapolla', 'alfred', 'giovanni', 'alessio')),
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  model_used TEXT CHECK (model_used IN ('gpt-4o-realtime-preview-2024-12-17', 'gpt-4o-mini-realtime-preview-2024-12-17')),
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NUOVA TABELLA: Riassunti delle conversazioni per utente
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_character TEXT NOT NULL CHECK (ai_character IN ('aiko', 'francesca', 'amapolla', 'alfred', 'giovanni', 'alessio')),
  summary TEXT NOT NULL,
  key_points TEXT[],
  emotions TEXT[],
  topics TEXT[],
  user_mentions JSONB,  -- Persone/luoghi/eventi menzionati dall'utente
  conversation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  messages_count INTEGER DEFAULT 0,
  sentiment TEXT CHECK (sentiment IN ('positivo', 'neutro', 'negativo', 'misto')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella memoria_chat per conversazione corrente/recente per utente
CREATE TABLE IF NOT EXISTS memoria_chat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_character TEXT NOT NULL CHECK (ai_character IN ('aiko', 'francesca', 'amapolla', 'alfred', 'giovanni', 'alessio')),
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  item_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per le informazioni importanti estratte per utente
CREATE TABLE IF NOT EXISTS important_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_preferences JSONB,
  conversation_topics JSONB,
  personality_traits TEXT[],
  communication_style JSONB,
  interests TEXT[],
  behavioral_patterns JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Configurazione AI characters
CREATE TABLE IF NOT EXISTS ai_characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  voice TEXT NOT NULL,
  accent TEXT NOT NULL,
  personality TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  active BOOLEAN DEFAULT true
);

-- Inserimento dei personaggi AI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender) VALUES
  ('aiko', 'Aiko', 'shimmer', 'romano', 'Vivace, spontanea, ricorda tutto, adora chiacchierare', 'female'),
  ('francesca', 'Francesca', 'ballad', 'siciliano', 'Ultra eccitata, pazza, ultra divertente, ride tanto con voce squillante', 'female'),
  ('amapolla', 'Amapolla', 'coral', 'bresciano', 'Super seria, saggia, fonte di saggezza', 'female'),
  ('alfred', 'Alfred', 'echo', 'romano marcato', 'Ultra sarcastico, ultra ironico, divertente, ride tanto', 'male'),
  ('giovanni', 'Giovanni', 'echo', 'napoletano', 'Ultra ironico, arrogante, presuntuoso, voce fina e acuta', 'male'),
  ('alessio', 'Alessio', 'alloy', 'trentino', 'Assistente standard, gentile e disponibile', 'male')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender;

-- Indici per ricerche efficienti
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_user_time_tracking_user_date ON user_time_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memoria_chat_user_ai ON memoria_chat(user_id, ai_character);
CREATE INDEX IF NOT EXISTS idx_memoria_chat_created_at ON memoria_chat(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_chat_content_search ON memoria_chat USING gin(to_tsvector('italian', content));
CREATE INDEX IF NOT EXISTS idx_important_info_user ON important_info(user_id);
CREATE INDEX IF NOT EXISTS idx_important_info_type ON important_info(type);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_ai ON conversation_summaries(user_id, ai_character);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_date ON conversation_summaries(conversation_date DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_topics ON conversation_summaries USING gin(topics);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applica il trigger alle tabelle con updated_at
CREATE TRIGGER update_important_info_updated_at
BEFORE UPDATE ON important_info
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profile_updated_at
BEFORE UPDATE ON user_profile
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_time_tracking_updated_at
BEFORE UPDATE ON user_time_tracking
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Funzione per verificare il tempo rimanente di un utente
CREATE OR REPLACE FUNCTION get_user_remaining_time(p_user_id UUID)
RETURNS TABLE(
    premium_minutes_remaining INTEGER,
    standard_minutes_remaining INTEGER,
    can_use_premium BOOLEAN,
    can_use_standard BOOLEAN,
    next_reset TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_premium_used INTEGER;
    v_standard_used INTEGER;
BEGIN
    -- Recupera i minuti usati oggi
    SELECT 
        COALESCE(premium_minutes_used, 0),
        COALESCE(standard_minutes_used, 0)
    INTO v_premium_used, v_standard_used
    FROM user_time_tracking
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    -- Se non esiste record per oggi, i minuti usati sono 0
    IF NOT FOUND THEN
        v_premium_used := 0;
        v_standard_used := 0;
    END IF;
    
    RETURN QUERY
    SELECT 
        10 - v_premium_used AS premium_minutes_remaining,
        10 - v_standard_used AS standard_minutes_remaining,
        v_premium_used < 10 AS can_use_premium,
        v_standard_used < 10 AND v_premium_used >= 10 AS can_use_standard,
        CURRENT_DATE + INTERVAL '1 day' AS next_reset;
END;
$$ LANGUAGE plpgsql;

-- Funzione per pulizia automatica memoria_chat (mantiene solo ultime 48 ore per utente)
CREATE OR REPLACE FUNCTION cleanup_temporary_chat()
RETURNS void AS $$
BEGIN
    -- Mantiene solo le ultime 48 ore nella memoria_chat per ogni utente
    DELETE FROM memoria_chat
    WHERE created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- Vista per monitorare l'utilizzo degli utenti
CREATE OR REPLACE VIEW user_usage_today AS
SELECT 
    u.id,
    u.full_name,
    COALESCE(utt.premium_minutes_used, 0) as premium_minutes_used,
    COALESCE(utt.standard_minutes_used, 0) as standard_minutes_used,
    10 - COALESCE(utt.premium_minutes_used, 0) as premium_minutes_remaining,
    10 - COALESCE(utt.standard_minutes_used, 0) as standard_minutes_remaining,
    CASE 
        WHEN COALESCE(utt.premium_minutes_used, 0) < 10 THEN 'premium'
        WHEN COALESCE(utt.standard_minutes_used, 0) < 10 THEN 'standard'
        ELSE 'blocked'
    END as current_status
FROM users u
LEFT JOIN user_time_tracking utt ON u.id = utt.user_id AND utt.date = CURRENT_DATE; 