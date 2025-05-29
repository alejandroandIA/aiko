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

- Node.js 18.0 o superiore
- Account OpenAI con accesso a:
  - Realtime API (gpt-4o-realtime-preview)
  - Whisper API
- Account Supabase con un database configurato
- Browser moderno con supporto WebRTC

## 🛠️ Installazione

### Metodo Automatico (Consigliato)

#### Windows
```bash
install.bat
```

#### macOS/Linux
```bash
chmod +x install.sh
./install.sh
```

### Metodo Manuale

1. **Clona il repository**
   ```bash
   git clone [url-repository]
   cd aiko
   ```

2. **Installa le dipendenze del backend**
   ```bash
   cd api
   npm install
   ```

3. **Configura le variabili d'ambiente**
   
   Crea un file `.env` nella directory `api/` con le seguenti variabili:
   ```env
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key_here

   # Supabase
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_SERVICE_KEY=your_supabase_service_key_here

   # Server (opzionale)
   PORT=3000
   NODE_ENV=development
   ```

4. **Configura il database Supabase**
   
   Esegui questa query SQL nel tuo database Supabase:
   ```sql
   CREATE TABLE chat_history (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     speaker TEXT NOT NULL,
     content TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Indice per ricerche efficienti
   CREATE INDEX idx_chat_history_created_at ON chat_history(created_at DESC);
   CREATE INDEX idx_chat_history_speaker ON chat_history(speaker);
   ```

## 🚀 Avvio

1. **Avvia il server backend**
   ```bash
   cd api
   npm start
   ```
   
   Per modalità sviluppo con auto-reload:
   ```bash
   npm run dev
   ```

2. **Accedi all'applicazione**
   
   Apri il browser e vai a: `http://localhost:3000`

## 📁 Struttura del Progetto

```
aiko/
├── api/                    # Backend Node.js
│   ├── server.js          # Server Express principale
│   ├── transcribeAudio.js # Handler per trascrizione audio
│   ├── session.js         # Gestione sessioni OpenAI
│   ├── saveToMemory.js    # Salvataggio conversazioni
│   ├── searchMemory.js    # Ricerca nella memoria
│   ├── generateContextSummary.js # Generazione riassunti
│   └── package.json       # Dipendenze backend
├── src/                   # Configurazioni
│   └── config/
│       └── aiConfig.mjs   # Configurazione personalità AI
├── index.html             # Interfaccia web
├── script.js              # Logica frontend
├── style.css              # Stili CSS
├── install.sh             # Script installazione Unix/Linux/macOS
├── install.bat            # Script installazione Windows
├── package.json           # Configurazione progetto principale
├── vercel.json            # Configurazione deployment Vercel
├── LICENSE                # Licenza MIT
├── CHANGELOG.md           # Storico versioni
├── README.md              # Documentazione
└── .gitignore             # File da ignorare in Git

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

- **Non condividere mai** il file `.env` o le tue chiavi API
- Usa sempre HTTPS in produzione
- Configura CORS appropriatamente per il tuo dominio
- Limita l'accesso al database Supabase con RLS (Row Level Security)

## 🐛 Risoluzione Problemi

### Errore "OPENAI_API_KEY non configurata"
- Verifica che il file `.env` esista nella directory `api/`
- Controlla che la chiave API sia valida

### Errore microfono
- Assicurati che il browser abbia i permessi per il microfono
- Verifica che non ci siano altre applicazioni usando il microfono

### Connessione WebRTC fallita
- Controlla la console del browser per errori specifici
- Verifica che la tua rete non blocchi WebRTC

## 📝 Note di Sviluppo

- Il progetto usa ES modules (`type: "module"`)
- Richiede Node.js 18+ per il flag `--watch`
- I file audio sono processati come Blob prima dell'invio
- La memoria è salvata in modo asincrono per non bloccare la conversazione

## 🤝 Contributi

Per contribuire al progetto:
1. Fork del repository
2. Crea un branch per la tua feature
3. Commit delle modifiche
4. Push al branch
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT.

## 🙏 Crediti

- OpenAI per le API Realtime e Whisper
- Supabase per il database e l'hosting
- La community open source per le librerie utilizzate

## 🚀 Deployment

### Deployment su Vercel

1. Installa Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Configura le variabili d'ambiente in Vercel:
   ```bash
   vercel secrets add openai_api_key "your_key_here"
   vercel secrets add supabase_url "your_url_here"
   vercel secrets add supabase_service_key "your_key_here"
   ```

3. Deploy:
   ```bash
   vercel
   ```

### Deployment su altre piattaforme

Il progetto include un server Express standard che può essere deployato su qualsiasi piattaforma che supporti Node.js 18+. 