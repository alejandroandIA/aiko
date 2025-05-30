# Aiko - AI Conversazionale Vocale

Un'app minimalista per conversazioni vocali naturali con un'intelligenza artificiale che ricorda tutto.

## 🎯 Caratteristiche

- **Solo voce**: Interfaccia ultra-semplice con solo 2 pulsanti (Parla/Chiudi)
- **Memoria intelligente**: Aiko ricorda le conversazioni precedenti tramite riassunti concisi
- **Estrazione automatica**: Salva automaticamente informazioni importanti (nomi, date, preferenze)
- **Ricerca contestuale**: Accede alla memoria solo quando necessario
- **Interfaccia Matrix**: Animazione stile Matrix con viso femminile che parla

## 🛠️ Tecnologie

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Voice API**: OpenAI Realtime API (WebRTC)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel (serverless)
- **AI Models**: GPT-4 Realtime + GPT-4 Mini

## 📁 Struttura

```
/
├── index.html          # Interfaccia minimale
├── style.css           # Stile Matrix/cyberpunk
├── script.js           # Logica WebRTC e animazioni
├── api/
│   ├── session.js              # Token OpenAI
│   ├── saveConversationSummary.js  # Salva riassunti
│   ├── generateContextSummary.js   # Recupera contesto
│   ├── searchMemory.js         # Cerca nella memoria
│   ├── extractImportantInfo.js # Estrae info importanti
│   └── saveImportantInfo.js    # Salva info importanti
└── src/config/
    └── aiConfig.mjs    # Personalità di Aiko
```

## 🗄️ Database Schema

### conversation_summaries
- Riassunti concisi di ogni conversazione
- Punti chiave, emozioni, topics
- Menzioni di persone/luoghi/eventi

### important_info
- Informazioni estratte automaticamente
- Categorizzate (famiglia, preferenze, progetti, etc.)
- Con livello di confidenza

### memoria_chat
- Solo ultime 48 ore (buffer temporaneo)
- Pulizia automatica

## 🚀 Setup

1. **Variabili ambiente su Vercel:**
   ```
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://...
   SUPABASE_SERVICE_KEY=...
   ```

2. **Database Supabase:**
   - Esegui `database_schema.sql`
   - Abilita Row Level Security

3. **Deploy su Vercel:**
   ```bash
   git push origin main
   ```

## 💬 Come funziona

1. **Inizio conversazione**: Aiko recupera contesto dalle conversazioni precedenti
2. **Durante la conversazione**: Audio in tempo reale via WebRTC
3. **Fine conversazione**: 
   - Estrae informazioni importanti
   - Genera e salva riassunto
   - Aggiorna memoria permanente

## 🎨 Interfaccia

- **Background**: Effetto Matrix animato
- **Centro**: Viso stilizzato che si anima quando Aiko parla
- **Controlli**: Solo PARLA e CHIUDI
- **Feedback**: Indicatore vocale e status minimale

## 🤖 Personalità di Aiko

- Estremamente umana e naturale
- Ricorda tutto delle conversazioni passate
- Usa la memoria in modo intelligente
- Si adatta allo stile comunicativo dell'utente
- Parla italiano con personalità vivace

## 📝 Note

- Nessuna trascrizione visibile (solo voce)
- Memoria basata su riassunti, non conversazioni complete
- Privacy: retention configurabile
- Performance: ricerche ottimizzate con indici PostgreSQL

---

Made with ❤️ by Alejandro 