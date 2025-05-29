# Aiko - Assistente AI Conversazionale

Aiko è un assistente AI conversazionale avanzato con memoria persistente, che utilizza OpenAI Realtime API per conversazioni vocali in tempo reale e Supabase per la gestione della memoria a lungo termine.

## 🚀 Caratteristiche

- **Conversazioni vocali in tempo reale** con OpenAI Realtime API
- **Memoria persistente** delle conversazioni tramite Supabase
- **Riconoscimento vocale** con OpenAI Whisper
- **Personalità AI dinamica** e contestuale
- **Ricerca intelligente** nelle conversazioni passate
- **Interfaccia web moderna** e responsive

## 📋 Prerequisiti

- Account GitHub
- Account Vercel
- Account OpenAI con accesso a:
  - Realtime API (gpt-4o-realtime-preview)
  - Whisper API
- Account Supabase con un database configurato
- Browser moderno con supporto WebRTC

## 🛠️ Deploy con Vercel

### 1. Fork o clona questo repository

Usa il pulsante "Fork" su GitHub o clona il repository nel tuo account.

### 2. Importa su Vercel

1. Vai su [vercel.com](https://vercel.com)
2. Clicca su **"Add New Project"**
3. Importa il repository dalla tua lista GitHub
4. Clicca su **"Import"**

### 3. Configura le variabili d'ambiente

Durante l'import (o in Settings → Environment Variables), aggiungi:

```
OPENAI_API_KEY = [la tua chiave OpenAI]
SUPABASE_URL = [il tuo URL Supabase]
SUPABASE_SERVICE_KEY = [la tua service key Supabase]
```

**Dove trovarle:**
- **OpenAI API Key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Supabase**: Nel tuo progetto Supabase → Settings → API
  - `SUPABASE_URL`: Project URL
  - `SUPABASE_SERVICE_KEY`: service_role key (secret)

### 4. Deploy

Clicca su **"Deploy"** e Vercel farà tutto automaticamente!

## 📊 Configurazione Database Supabase

Nel tuo progetto Supabase, esegui questa query SQL:

```sql
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  speaker TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per ricerche efficienti
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at DESC);
CREATE INDEX idx_chat_history_speaker ON chat_history(speaker);
```

## 📁 Struttura del Progetto

```
aiko/
├── api/                    # Funzioni serverless Vercel
│   ├── transcribeAudio.js # Handler per trascrizione audio
│   ├── session.js         # Gestione sessioni OpenAI
│   ├── saveToMemory.js    # Salvataggio conversazioni
│   ├── searchMemory.js    # Ricerca nella memoria
│   ├── generateContextSummary.js # Generazione riassunti
│   └── package.json       # Dipendenze delle funzioni
├── src/                   # Configurazioni
│   └── config/
│       └── aiConfig.mjs   # Configurazione personalità AI
├── index.html             # Interfaccia web
├── script.js              # Logica frontend
├── style.css              # Stili CSS
└── README.md              # Documentazione
```

## 🔧 Configurazione

### Personalizzazione AI

Modifica `src/config/aiConfig.mjs` per personalizzare:
- Nome dell'AI (default: "Aiko")
- Nome dell'utente (default: "Alejandro")
- Personalità e comportamento dell'AI
- Istruzioni di base

### Parametri Tecnici

Nel file `script.js`:
- `MODEL_NAME`: Modello OpenAI da utilizzare
- `silence_duration_ms`: Durata silenzio per rilevamento fine parlato
- `threshold`: Soglia di rilevamento voce

## 🔒 Sicurezza

- Le chiavi API sono protette nelle variabili d'ambiente di Vercel
- Non modificare mai le chiavi direttamente nel codice
- Usa sempre HTTPS (automatico con Vercel)
- Configura RLS (Row Level Security) in Supabase per maggiore sicurezza

## 🐛 Risoluzione Problemi

### La app non si connette
- Verifica che tutte le variabili d'ambiente siano configurate in Vercel
- Controlla i log nella dashboard Vercel (Functions tab)

### Errore microfono
- Assicurati che il browser abbia i permessi per il microfono
- Usa HTTPS (automatico con Vercel)

### Database non funziona
- Verifica che la tabella `chat_history` sia stata creata
- Controlla che `SUPABASE_SERVICE_KEY` sia la chiave corretta (service_role)

## 📝 Aggiornamenti

Per aggiornare l'app:
1. Modifica i file in Cursor
2. Fai commit e push su GitHub
3. Vercel rileverà automaticamente i cambiamenti e farà un nuovo deploy

## 🤝 Contributi

1. Fork del repository
2. Crea le tue modifiche
3. Push al tuo fork
4. Crea una Pull Request

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.

## 🙏 Crediti

- OpenAI per le API Realtime e Whisper
- Supabase per il database
- Vercel per l'hosting serverless 