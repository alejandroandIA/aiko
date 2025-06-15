# CI SONO IO - Conversazioni Straordinarie con Persone Vere

## 🔌 MODALITÀ OFFLINE ATTIVA

**CI SONO IO v2.0 ora funziona SENZA database Supabase!**

### Cosa funziona in modalità offline:
- ✅ Login con nome e cognome (salvato solo in memoria locale)
- ✅ 9 sezioni tematiche con 40+ personaggi
- ✅ Conversazioni complete con OpenAI Realtime API
- ✅ La IA conosce il tuo nome e lo usa nelle conversazioni
- ✅ Timer di 20 minuti per ogni conversazione
- ✅ Tutte le animazioni e l'interfaccia vivace

### Cosa NON funziona in modalità offline:
- ❌ Memoria delle conversazioni passate
- ❌ Salvataggio delle conversazioni
- ❌ Limite giornaliero (puoi parlare quanto vuoi)

### Come funziona:
1. Inserisci nome e cognome
2. Scegli una sezione tematica
3. Seleziona un personaggio
4. Parla per 20 minuti
5. La IA sa chi sei ma non ricorda le conversazioni precedenti

---

## Panoramica

Una piattaforma innovativa per conversazioni vocali naturali con intelligenze artificiali che hanno personalità uniche e ricordano tutto di te.

## 🎯 Caratteristiche

- **6 AI con personalità uniche**: 3 femminili (Aiko, Francesca, Amapolla) e 3 maschili (Alfred, Giovanni, Alessio)
- **Memoria personalizzata**: Ogni AI ricorda le conversazioni precedenti con ogni utente
- **Sistema di tempo giornaliero**: 10 minuti premium + 10 minuti standard al giorno
- **Login semplice**: Solo nome e cognome per accedere
- **Interfaccia elegante**: Design moderno con effetto Matrix
- **Solo voce**: Conversazioni naturali in tempo reale

## 🤖 Le Personalità

### AI Femminili
- **Aiko**: Vivace romana di 25 anni, spontanea e affettuosa
- **Francesca**: Siciliana ultra eccitata, divertentissima e squillante
- **Amapolla**: Bresciana saggia e riflessiva, fonte di saggezza

### AI Maschili
- **Alfred**: Romano sarcastico e ironico, prende in giro con affetto
- **Giovanni**: Napoletano arrogante e presuntuoso, sempre saccente
- **Alessio**: Trentino gentile e disponibile, sempre pronto ad aiutare

## 🛠️ Tecnologie

- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Voice API**: OpenAI Realtime API (WebRTC)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel (serverless)
- **AI Models**: 
  - GPT-4o Realtime (primi 10 minuti)
  - GPT-4o Mini Realtime (secondi 10 minuti)

## 📁 Struttura

```
/
├── index.html          # Homepage con login e selezione AI
├── style.css           # Stile moderno con effetto Matrix
├── script.js           # Logica principale e gestione conversazioni
├── api/
│   ├── login.js                    # Gestione login utenti
│   ├── checkUserTime.js           # Verifica tempo disponibile
│   ├── updateUserTime.js          # Aggiorna tempo utilizzato
│   ├── session.js                 # Token OpenAI per WebRTC
│   ├── saveConversationSummary.js # Salva riassunti conversazioni
│   ├── generateContextSummary.js  # Genera contesto per AI
│   ├── searchMemory.js           # Cerca nella memoria
│   ├── extractImportantInfo.js   # Estrae info importanti
│   └── saveImportantInfo.js      # Salva info importanti
└── database_schema.sql            # Schema database completo
```

## 🗄️ Database Schema

### Tabelle principali
- **users**: Gestione utenti (nome, cognome)
- **user_time_tracking**: Tracciamento tempo giornaliero
- **conversation_sessions**: Sessioni di conversazione
- **conversation_summaries**: Riassunti per memoria a lungo termine
- **important_info**: Informazioni importanti estratte
- **ai_characters**: Configurazione delle 6 AI

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
   - Crea le funzioni RPC necessarie

3. **Deploy su Vercel:**
   ```bash
   git push origin main
   ```

## 💬 Come funziona

1. **Login**: L'utente inserisce nome e cognome
2. **Selezione AI**: Sceglie una delle 6 personalità disponibili
3. **Conversazione**: 
   - Primi 10 minuti con modello premium
   - Successivi 10 minuti con modello standard
   - Timer visibile in alto a destra
4. **Memoria**: Ogni AI ricorda tutto delle conversazioni precedenti con quell'utente
5. **Reset giornaliero**: Il tempo si resetta ogni 24 ore

## 🎨 Interfaccia

- **Homepage**: Login e griglia di selezione AI
- **Conversazione**: Viso animato dell'AI con effetto Matrix
- **Timer**: Countdown del tempo rimanente
- **Navigazione**: Sezioni Info e Contatti

## 🔒 Privacy

- Ogni utente ha memoria separata
- Le AI non condividono informazioni tra utenti diversi
- Retention configurabile delle conversazioni

## 📝 Note per lo sviluppo

- Le AI devono sempre comportarsi come persone vere
- Mai rivelare di essere intelligenze artificiali
- Ogni AI mantiene coerentemente la propria personalità
- Sistema di memoria basato su riassunti per efficienza

---

Creato con ❤️ da Alejandro Aguilar

**CI SONO IO** - Dove le conversazioni prendono vita 