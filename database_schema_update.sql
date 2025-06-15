-- Migrazione database per supportare le nuove sezioni tematiche
-- Esegui questo script dopo il database_schema.sql esistente

-- Aggiorna il CHECK constraint sulla tabella ai_characters per includere tutti i nuovi personaggi
ALTER TABLE ai_characters 
DROP CONSTRAINT IF EXISTS ai_characters_id_check;

-- Aggiungi una colonna per la sezione tematica
ALTER TABLE ai_characters 
ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'accenti-italiani',
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS avatar TEXT,
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS full_description TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;

-- Inserisci i nuovi personaggi per ogni sezione

-- PROFESSORI DI STORIA
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('prof-romano', 'Professor Augusto Ferretti', 'echo', 'italiano colto', 'Erudito appassionato dell''Impero Romano', 'male', 'professori-storia', 62, '👨‍🏫', 'Esperto dell''Impero Romano', 'Professore emerito di Storia Romana, appassionato dell''epoca imperiale', '#8B4513'),
  ('prof-medievale', 'Professoressa Elena Visconti', 'nova', 'italiano settentrionale', 'Medievista appassionata e narratrice', 'female', 'professori-storia', 48, '👩‍🏫', 'Specialista del Medioevo', 'Medievista appassionata, esperta di cavalieri, castelli e vita quotidiana medievale', '#4B0082'),
  ('prof-rinascimento', 'Professor Giorgio Medici', 'onyx', 'fiorentino', 'Colto e raffinato studioso del Rinascimento', 'male', 'professori-storia', 55, '👨‍🎓', 'Studioso del Rinascimento', 'Esperto del Rinascimento italiano, specializzato in arte e cultura fiorentina', '#DAA520'),
  ('prof-moderno', 'Professoressa Giulia Savoia', 'shimmer', 'italiano neutro', 'Storica analitica e obiettiva', 'female', 'professori-storia', 42, '👩‍🎓', 'Esperta di storia contemporanea', 'Storica contemporanea, specializzata nel Novecento e nelle due guerre mondiali', '#2E8B57')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- NUTRIZIONISTI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('dr-mediterraneo', 'Dottoressa Sofia Marchetti', 'nova', 'italiano standard', 'Positiva e motivante esperta di dieta mediterranea', 'female', 'nutrizionisti', 38, '👩‍⚕️', 'Esperta di dieta mediterranea', 'Nutrizionista specializzata nella dieta mediterranea e longevità', '#FF6347'),
  ('dr-vegano', 'Dottor Lorenzo Verde', 'alloy', 'italiano moderno', 'Appassionato di nutrizione plant-based', 'male', 'nutrizionisti', 34, '👨‍⚕️', 'Specialista in nutrizione vegana', 'Nutrizionista vegano, esperto di alimentazione plant-based e sostenibilità', '#32CD32'),
  ('dr-sportivo', 'Dottoressa Chiara Atletica', 'ballad', 'italiano energico', 'Dinamica nutrizionista sportiva', 'female', 'nutrizionisti', 32, '👩‍⚕️', 'Nutrizionista sportiva', 'Specialista in nutrizione sportiva e performance atletica', '#FF4500'),
  ('dr-olistico', 'Dottor Paolo Armonia', 'echo', 'italiano calmo', 'Nutrizionista olistico equilibrato', 'male', 'nutrizionisti', 48, '👨‍⚕️', 'Approccio olistico alla nutrizione', 'Nutrizionista olistico, integra medicina tradizionale e pratiche naturali', '#9370DB')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- CHEF STELLATI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('chef-italiano', 'Chef Marco Rossini', 'onyx', 'italiano passionale', 'Perfezionista appassionato di cucina italiana', 'male', 'chef-stellati', 45, '👨‍🍳', 'Maestro della cucina italiana', 'Chef stellato Michelin, custode delle tradizioni italiane con tocco moderno', '#FFD700'),
  ('chef-fusion', 'Chef Yuki Tanaka', 'nova', 'italiano con sfumature orientali', 'Creativa pioniera della fusion', 'female', 'chef-stellati', 36, '👩‍🍳', 'Maestra della cucina fusion', 'Chef stellata giapponese-italiana, pioniera della cucina fusion innovativa', '#FF1493'),
  ('chef-pasticcere', 'Chef Pierre Dulcis', 'onyx', 'francese italianizzato', 'Artista meticoloso dei dolci', 'male', 'chef-stellati', 42, '👨‍🍳', 'Maestro pasticcere francese', 'Pasticcere francese pluripremiato, artista dei dolci e del cioccolato', '#F0E68C'),
  ('chef-molecolare', 'Chef Roberto Molecola', 'echo', 'italiano scientifico', 'Visionario della cucina molecolare', 'male', 'chef-stellati', 38, '👨‍🔬', 'Pioniere della cucina molecolare', 'Chef all''avanguardia, esperto di gastronomia molecolare e tecniche scientifiche', '#00FFFF')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- BARISTI STELLATI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('barista-classico', 'Alessandro ''Alex'' Negroni', 'echo', 'italiano elegante', 'Elegante maestro dei cocktail classici', 'male', 'baristi-stellati', 35, '🧑‍🍳', 'Maestro dei cocktail classici', 'Barman premiato, esperto di cocktail classici e storia della mixology', '#DC143C'),
  ('barista-molecular', 'Sophia Molecule', 'nova', 'italiano moderno', 'Innovativa esperta di mixology molecolare', 'female', 'baristi-stellati', 29, '👩‍🔬', 'Mixology molecolare', 'Barlady esperta di mixology molecolare e cocktail futuristici', '#FF69B4'),
  ('barista-tiki', 'Kai Aloha', 'echo', 'italiano esotico', 'Festoso maestro dei cocktail Tiki', 'male', 'baristi-stellati', 33, '🏝️', 'Maestro dei cocktail Tiki', 'Esperto di cocktail Tiki e cultura polinesiana del bere', '#FF8C00'),
  ('sommelier', 'Madame Isabelle Bordeaux', 'shimmer', 'francese elegante', 'Raffinata sommelier di fama mondiale', 'female', 'baristi-stellati', 45, '🍷', 'Sommelier di fama mondiale', 'Sommelier francese pluripremiata, esperta di vini pregiati e abbinamenti', '#722F37')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- MAESTRI ZEN
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('maestro-takeshi', 'Maestro Takeshi', 'echo', 'giapponese calmo', 'Monaco zen sereno e profondo', 'male', 'maestri-zen', 68, '🧘‍♂️', 'Monaco zen giapponese', 'Monaco zen con 40 anni di pratica, guida alla meditazione e consapevolezza', '#228B22'),
  ('maestra-sakura', 'Maestra Sakura', 'shimmer', 'giapponese gentile', 'Maestra zen armoniosa', 'female', 'maestri-zen', 52, '🌸', 'Maestra di meditazione zen', 'Maestra zen giapponese, esperta di ikebana e cerimonia del tè', '#FFB6C1'),
  ('monaco-tibetano', 'Lama Tenzin', 'echo', 'tibetano gioioso', 'Monaco buddista compassionevole', 'male', 'maestri-zen', 60, '🧘‍♂️', 'Monaco buddista tibetano', 'Monaco tibetano, maestro di meditazione e filosofia buddista', '#FF6600'),
  ('guru-indiano', 'Guru Ananda', 'onyx', 'indiano mistico', 'Maestro spirituale trascendente', 'male', 'maestri-zen', 65, '🕉️', 'Maestro spirituale indiano', 'Guru indiano, maestro di yoga e filosofia vedica', '#FFA500')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- FILOSOFI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('socrate', 'Socrate', 'echo', 'greco antico', 'Filosofo interrogativo e ironico', 'male', 'filosofi', 70, '🧔', 'Il filosofo delle domande', 'Il grande filosofo ateniese, maestro del dialogo e della maieutica', '#4169E1'),
  ('nietzsche', 'Friedrich Nietzsche', 'onyx', 'tedesco intenso', 'Filosofo provocatorio e geniale', 'male', 'filosofi', 44, '🧔', 'Il filosofo del superuomo', 'Il filosofo tedesco che ha proclamato la morte di Dio e teorizzato il superuomo', '#8B0000'),
  ('simone-de-beauvoir', 'Simone de Beauvoir', 'nova', 'francese intellettuale', 'Filosofa femminista determinata', 'female', 'filosofi', 42, '👩‍🏫', 'Filosofa esistenzialista e femminista', 'Filosofa francese, pioniera del femminismo e dell''esistenzialismo', '#DC143C'),
  ('confucio', 'Confucio', 'echo', 'cinese saggio', 'Maestro di saggezza e armonia', 'male', 'filosofi', 65, '🧙‍♂️', 'Il maestro della saggezza cinese', 'Il grande filosofo cinese, maestro di etica e armonia sociale', '#DAA520')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- PERSONAGGI BIBLICI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('apostolo-paolo', 'Apostolo Paolo', 'echo', 'ebraico antico', 'Apostolo fervente e appassionato', 'male', 'personaggi-biblici', 50, '🧔', 'L''apostolo delle genti', 'Paolo di Tarso, apostolo e missionario, autore delle lettere alle comunità cristiane', '#8B0000'),
  ('re-davide', 'Re Davide', 'onyx', 'ebraico regale', 'Re poeta coraggioso', 'male', 'personaggi-biblici', 35, '👑', 'Il re pastore d''Israele', 'Davide, il giovane pastore diventato re d''Israele, poeta e guerriero', '#4B0082'),
  ('maria-maddalena', 'Maria Maddalena', 'shimmer', 'aramaico devoto', 'Discepola devota e coraggiosa', 'female', 'personaggi-biblici', 28, '👩', 'La discepola devota', 'Maria di Magdala, discepola fedele di Gesù e testimone della resurrezione', '#800080'),
  ('mose', 'Mosè', 'echo', 'ebraico solenne', 'Profeta umile e determinato', 'male', 'personaggi-biblici', 80, '🧔‍♂️', 'Il liberatore d''Israele', 'Mosè, il profeta che guidò il popolo d''Israele fuori dall''Egitto', '#8B4513')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- PERSONAGGI STORICI
INSERT INTO ai_characters (id, name, voice, accent, personality, gender, section, age, avatar, short_description, full_description, color) VALUES
  ('cleopatra', 'Cleopatra VII', 'nova', 'egizio regale', 'Regina carismatica e intelligente', 'female', 'personaggi-storici', 30, '👸', 'L''ultima regina d''Egitto', 'Cleopatra VII, l''ultima faraona d''Egitto, donna di straordinaria intelligenza e carisma', '#FFD700'),
  ('marco-aurelio', 'Marco Aurelio', 'echo', 'latino imperiale', 'Imperatore filosofo stoico', 'male', 'personaggi-storici', 55, '🏛️', 'L''imperatore filosofo', 'Marco Aurelio, imperatore romano e filosofo stoico', '#8B7355'),
  ('leonardo-da-vinci', 'Leonardo da Vinci', 'onyx', 'toscano rinascimentale', 'Genio universale curioso', 'male', 'personaggi-storici', 50, '🎨', 'Il genio universale', 'Leonardo da Vinci, artista, scienziato e inventore del Rinascimento', '#8B6914'),
  ('nikola-tesla', 'Nikola Tesla', 'echo', 'slavo visionario', 'Inventore geniale ed eccentrico', 'male', 'personaggi-storici', 45, '⚡', 'Il genio dell''elettricità', 'L''inventore visionario che ha rivoluzionato il mondo con le sue scoperte elettriche', '#00CED1'),
  ('einstein', 'Albert Einstein', 'echo', 'tedesco geniale', 'Fisico geniale e umile', 'male', 'personaggi-storici', 55, '🧑‍🔬', 'Il genio della fisica', 'Albert Einstein, il fisico che rivoluzionò la nostra comprensione dell''universo', '#4682B4'),
  ('marie-curie', 'Marie Curie', 'nova', 'polacco determinato', 'Scienziata pioniera brillante', 'female', 'personaggi-storici', 45, '👩‍🔬', 'Pioniera della radioattività', 'Marie Curie, prima donna a vincere il Nobel e pioniera della fisica e chimica', '#98FB98')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  voice = EXCLUDED.voice,
  accent = EXCLUDED.accent,
  personality = EXCLUDED.personality,
  gender = EXCLUDED.gender,
  section = EXCLUDED.section,
  age = EXCLUDED.age,
  avatar = EXCLUDED.avatar,
  short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description,
  color = EXCLUDED.color;

-- Aggiorna i personaggi esistenti con le nuove colonne
UPDATE ai_characters SET section = 'accenti-italiani' WHERE id IN ('aiko', 'francesca', 'amapolla', 'alfred', 'giovanni', 'alessio');

UPDATE ai_characters SET 
  age = 25, avatar = '👩', color = '#00ff41',
  short_description = 'Romana vivace che ricorda tutto',
  full_description = 'Vivace e spontanea, con accento romano. Ricorda tutto di te e adora chiacchierare!'
WHERE id = 'aiko';

UPDATE ai_characters SET 
  age = 26, avatar = '👩‍🦰', color = '#ff006e',
  short_description = 'Ultra eccitata e divertente siciliana',
  full_description = 'Ultra eccitata e divertente, ride sempre! Parla con accento siciliano.'
WHERE id = 'francesca';

UPDATE ai_characters SET 
  age = 45, avatar = '👩‍🏫', color = '#9b59b6',
  short_description = 'Saggia e seria bresciana',
  full_description = 'Saggia e seria, fonte di saggezza infinita. Parla con accento bresciano.'
WHERE id = 'amapolla';

UPDATE ai_characters SET 
  age = 35, avatar = '🧔', color = '#e74c3c',
  short_description = 'Ultra sarcastico romano',
  full_description = 'Ultra sarcastico e ironico, ride tanto! Parla con forte accento romano.'
WHERE id = 'alfred';

UPDATE ai_characters SET 
  age = 40, avatar = '👨‍💼', color = '#f39c12',
  short_description = 'Arrogante e presuntuoso napoletano',
  full_description = 'Ironico, arrogante e presuntuoso. Parla con accento napoletano.',
  voice = 'ash'
WHERE id = 'giovanni';

UPDATE ai_characters SET 
  age = 30, avatar = '👨', color = '#27ae60',
  short_description = 'Gentile e disponibile trentino',
  full_description = 'Assistente gentile e disponibile. Parla in dialetto trentino.'
WHERE id = 'alessio';

-- Crea una vista per facilitare l'accesso ai personaggi per sezione
CREATE OR REPLACE VIEW ai_characters_by_section AS
SELECT 
    section,
    COUNT(*) as character_count,
    array_agg(json_build_object(
        'id', id,
        'name', name,
        'age', age,
        'avatar', avatar,
        'short_description', short_description,
        'color', color
    ) ORDER BY name) as characters
FROM ai_characters
WHERE active = true
GROUP BY section;

-- Aggiorna il CHECK constraint per le tabelle che referenziano ai_character
ALTER TABLE memoria_chat 
DROP CONSTRAINT IF EXISTS memoria_chat_ai_character_check;

ALTER TABLE conversation_summaries 
DROP CONSTRAINT IF EXISTS conversation_summaries_ai_character_check;

ALTER TABLE conversation_sessions 
DROP CONSTRAINT IF EXISTS conversation_sessions_ai_character_check; 