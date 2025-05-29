# Aiko - Assistente AI con Memoria Avanzata 🧠

Aiko è un assistente AI conversazionale con memoria persistente avanzata, simile a ChatGPT. Basato su OpenAI Realtime API, può conversare in italiano, ricordare informazioni personali e mantenere un profilo dettagliato dell'utente.

## 🌟 Caratteristiche Principali

- **Conversazioni in tempo reale** con OpenAI GPT-4
- **Sistema di memoria multi-livello** (simile a ChatGPT):
  - Memoria a breve termine (sessione corrente)
  - Memoria a lungo termine (informazioni importanti estratte)
  - Profilo utente dinamico con preferenze di risposta
  - Metadati delle sessioni e analisi comportamentale
- **Trascrizione audio** con Whisper API
- **Gestione trasparente della memoria** tramite interfaccia web dedicata
- **Privacy e controllo utente** completo sui dati memorizzati

## 🚀 Setup Rapido

### 1. Prerequisiti

- Account [Supabase](https://supabase.com) per il database
- Account [OpenAI](https://platform.openai.com) con accesso alle API
- Account [Vercel](https://vercel.com) per il deployment

### 2. Configurazione Database

Crea le seguenti tabelle in Supabase usando lo schema in `database_schema.sql`:

```sql
-- Tabelle principali
- memoria_chat (conversazioni)
- important_info (informazioni estratte)
- user_profile (profilo utente)
- session_metadata (metadati sessioni)
- memory_preferences (preferenze privacy)
```

### 3. Variabili d'Ambiente

In Vercel, configura:

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### 4. Deploy

1. Fork questo repository
2. Importa in Vercel
3. Le variabili d'ambiente saranno richieste automaticamente
4. Deploy!

## 🧠 Sistema di Memoria Avanzato

### Architettura della Memoria

Il sistema di memoria di Aiko è ispirato a ChatGPT e include:

1. **Estrazione Automatica**: Dopo ogni conversazione, le informazioni importanti vengono estratte automaticamente
2. **Profiling Utente**: Analisi periodica delle conversazioni per creare un profilo dettagliato
3. **Ricerca Contestuale**: Aiko può cercare informazioni specifiche nella memoria quando necessario
4. **Gestione Trasparente**: L'utente può vedere, modificare ed eliminare qualsiasi memoria

### Tipi di Memoria

- **Famiglia**: Informazioni su familiari e relazioni
- **Persona**: Nomi e dettagli di persone menzionate
- **Data**: Date importanti, compleanni, anniversari
- **Luogo**: Luoghi significativi
- **Preferenza**: Gusti e preferenze personali
- **Progetto**: Progetti e attività in corso
- **Altro**: Altre informazioni rilevanti

### Gestione della Memoria

Accedi a `/memory-manager.html` per:

- 📋 Visualizzare tutte le memorie salvate
- ✏️ Modificare o aggiungere memorie manualmente
- 🗑️ Eliminare memorie specifiche
- 👤 Vedere il profilo utente generato
- 📊 Analizzare le sessioni passate
- ⚙️ Configurare le preferenze di privacy

## 📁 Struttura del Progetto

```
aiko/
├── api/                           # Funzioni serverless
│   ├── transcribeAudio.js        # Trascrizione audio
│   ├── session.js                # Gestione sessioni
│   ├── saveToMemory.js          # Salvataggio conversazioni
│   ├── searchMemory.js          # Ricerca nella memoria
│   ├── generateContextSummary.js # Generazione contesto
│   ├── extractImportantInfo.js  # Estrazione info importanti
│   ├── saveImportantInfo.js     # Salvataggio info importanti
│   ├── getImportantInfo.js      # Recupero info importanti
│   ├── manageMemory.js          # Gestione memoria (CRUD)
│   ├── userProfile.js           # Profilo utente
│   └── sessionMetadata.js       # Metadati sessioni
├── src/
│   └── config/
│       └── aiConfig.mjs         # Configurazione personalità AI
├── index.html                   # Interfaccia conversazione
├── memory-manager.html          # Interfaccia gestione memoria
├── script.js                    # Logica frontend
├── database_schema.sql          # Schema database completo
└── README.md                    # Questo file
```

## 🔧 API Endpoints

### Conversazione
- `POST /api/session` - Crea sessione OpenAI
- `POST /api/transcribeAudio` - Trascrivi audio con Whisper

### Memoria
- `GET /api/generateContextSummary` - Genera contesto iniziale
- `POST /api/saveToMemory` - Salva conversazione
- `GET /api/searchMemory` - Cerca nella memoria
- `POST /api/extractImportantInfo` - Estrai info importanti
- `POST /api/saveImportantInfo` - Salva info importante
- `GET /api/getImportantInfo` - Recupera info importanti

### Gestione Avanzata
- `GET/POST/DELETE /api/manageMemory` - CRUD completo memorie
- `GET/POST /api/userProfile` - Gestione profilo utente
- `GET/POST /api/sessionMetadata` - Metadati sessioni

## 🔐 Privacy e Sicurezza

- **Controllo Totale**: L'utente può vedere e modificare tutto ciò che Aiko ricorda
- **Cancellazione Selettiva**: Possibilità di eliminare memorie specifiche
- **Retention Policy**: Configurabile (default 90 giorni)
- **Modalità Privacy**: Disattivabile per sessioni senza memoria

## 🎯 Personalizzazione

### Personalità di Aiko

Modifica `src/config/aiConfig.mjs` per personalizzare:
- Nome dell'AI
- Stile di conversazione
- Livello di formalità
- Uso dell'umorismo

### Tipi di Memoria

Aggiungi nuovi tipi di memoria modificando:
1. Il constraint CHECK in `database_schema.sql`
2. Le opzioni nel form di `memory-manager.html`
3. La logica di estrazione in `extractImportantInfo.js`

## 📊 Monitoraggio e Analytics

Il sistema traccia automaticamente:
- Numero di messaggi per sessione
- Durata delle conversazioni
- Sentiment analysis
- Argomenti più frequenti
- Pattern di utilizzo

## 🐛 Troubleshooting

### "Aiko non ricorda nulla"
1. Verifica che le tabelle siano create correttamente
2. Controlla i log in Vercel per errori
3. Assicurati che `extractImportantInfo` funzioni

### "Errore di trascrizione"
1. Verifica la chiave API OpenAI
2. Controlla il formato audio (consigliato: webm/opus)
3. Aumenta il timeout se necessario

### "Memoria non aggiornata"
1. Il profilo si aggiorna solo periodicamente
2. Forza l'aggiornamento da memory-manager.html
3. Verifica i permessi Supabase

## 🚀 Miglioramenti Futuri

- [ ] Esportazione memoria in formato JSON/CSV
- [ ] Backup automatico delle memorie
- [ ] Integrazione con calendar per promemoria
- [ ] Analisi avanzata delle conversazioni
- [ ] Multi-lingua per il sistema di memoria
- [ ] Crittografia end-to-end delle memorie

## 📝 Note Tecniche

- La memoria viene gestita in modo asincrono dopo ogni conversazione
- Il profilo utente viene aggiornato ogni ~10 conversazioni
- La ricerca supporta sia full-text che pattern matching
- I metadati delle sessioni aiutano a migliorare le risposte future

## 🤝 Contributi

Sentiti libero di aprire issue o PR per miglioramenti!

## 📄 Licenza

MIT License - Usa Aiko come preferisci!

---

Made with ❤️ for AI enthusiasts who want transparency in their AI assistants. 