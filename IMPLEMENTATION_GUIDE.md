# 🚀 Guida all'Implementazione - CI SONO IO v2.0

## Panoramica
Questa guida ti aiuterà a implementare la versione espansa di CI SONO IO con 9 sezioni tematiche e oltre 40 personaggi unici.

## 📋 Passi per l'Implementazione

### 1. Backup del Progetto Esistente
```bash
# Crea un backup del progetto attuale
cp -r . ../aiko-backup-$(date +%Y%m%d)
```

### 2. Crea la Struttura delle Directory
```bash
# Crea la directory per le configurazioni
mkdir -p src/config
```

### 3. Copia i Nuovi File

#### A. File di Configurazione
- Copia `src/config/ai-characters.js` nella directory `src/config/`
- Copia `src/config/character-instructions.js` nella directory `src/config/`

#### B. File Frontend
- Rinomina `index.html` in `index-old.html` (per backup)
- Rinomina `index-new.html` in `index.html`
- Rinomina `style.css` in `style-old.css` (per backup)
- Rinomina `style-new.css` in `style.css`
- Rinomina `script.js` in `script-old.js` (per backup)
- Rinomina `script-new.js` in `script.js`

### 4. Aggiorna il Database

#### A. Connettiti a Supabase
```sql
-- Esegui il contenuto di database_schema_update.sql nel tuo database Supabase
-- Questo aggiungerà tutti i nuovi personaggi e le colonne necessarie
```

#### B. Verifica l'Aggiornamento
```sql
-- Verifica che tutti i personaggi siano stati inseriti
SELECT section, COUNT(*) as count 
FROM ai_characters 
GROUP BY section 
ORDER BY section;
```

### 5. Aggiorna le API Serverless

Le API esistenti dovrebbero funzionare senza modifiche, ma verifica che:

#### A. `api/session.js`
- Gestisca correttamente il parametro `voice` per le nuove voci
- Le istruzioni personalizzate vengano passate correttamente

#### B. `api/saveConversationSummary.js`
- Supporti il salvataggio per tutti i nuovi `ai_character` IDs

### 6. Configurazione Variabili d'Ambiente

Assicurati che in Vercel siano configurate:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_key
OPENAI_API_KEY=your_openai_key
```

### 7. Test Pre-Deploy

#### A. Test Locale
```bash
# Installa Vercel CLI se non l'hai già
npm i -g vercel

# Esegui in locale
vercel dev
```

#### B. Verifica Funzionalità
- [ ] Login funziona correttamente
- [ ] Le 9 sezioni sono visibili
- [ ] Tutti i personaggi appaiono nelle rispettive sezioni
- [ ] La selezione di un personaggio funziona
- [ ] Le conversazioni si avviano correttamente
- [ ] Le animazioni funzionano
- [ ] Il timer funziona
- [ ] Il salvataggio delle conversazioni funziona

### 8. Deploy su Vercel

```bash
# Deploy su Vercel
vercel --prod
```

## 🎨 Personalizzazioni Opzionali

### Modifica Colori Tema
Nel file `style.css`, puoi modificare le variabili CSS:
```css
:root {
    --primary-color: #00ff41;      /* Verde principale */
    --secondary-color: #ff006e;     /* Rosa accento */
    --tertiary-color: #00d4ff;      /* Blu accento */
    --accent-color: #ffaa00;        /* Arancione accento */
}
```

### Aggiungi Nuovi Personaggi
1. Aggiungi il personaggio in `src/config/ai-characters.js`
2. Aggiungi le istruzioni in `src/config/character-instructions.js`
3. Inserisci nel database con una query SQL
4. Aggiungi l'ID del personaggio all'array della sezione appropriata

### Modifica Animazioni
- Matrix: modifica la stringa in `initMatrixAnimation()` in `script.js`
- Particelle: modifica `particleCount` e colori in `initParticleAnimation()`

## 🐛 Troubleshooting

### Problema: I nuovi personaggi non appaiono
**Soluzione**: Verifica che il database sia stato aggiornato correttamente e che i personaggi siano attivi (`active = true`)

### Problema: Le voci non funzionano per alcuni personaggi
**Soluzione**: Verifica che le voci utilizzate siano supportate da OpenAI Realtime API

### Problema: Errori CORS
**Soluzione**: Verifica la configurazione in `vercel.json`

### Problema: Le animazioni rallentano il sito
**Soluzione**: Riduci `particleCount` o disabilita alcune animazioni su dispositivi mobili

## 📞 Supporto

Per qualsiasi problema o domanda:
- Email: alejandro@cisonoio.it
- Telefono: +39 333 1234567

## 🎉 Congratulazioni!

Hai implementato con successo CI SONO IO v2.0! La piattaforma ora offre:
- 9 sezioni tematiche uniche
- Oltre 40 personaggi con personalità profonde
- Un'esperienza visiva vivace e teatrale
- Conversazioni autentiche e coinvolgenti

Buon divertimento con le nuove conversazioni straordinarie! 🌟 