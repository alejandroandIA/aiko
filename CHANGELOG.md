# Changelog

Tutte le modifiche significative a questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [1.0.0] - 2024-01-09

### Aggiunto
- Implementazione iniziale di Aiko con supporto per conversazioni vocali in tempo reale
- Integrazione con OpenAI Realtime API per conversazioni naturali
- Sistema di memoria persistente con Supabase
- Trascrizione audio con OpenAI Whisper API
- Interfaccia web responsive e moderna
- Funzione di ricerca nella memoria delle conversazioni passate
- Generazione automatica di riassunti contestuali
- Supporto per personalità AI configurabile
- Script di installazione automatica per Windows e Unix/Linux/macOS
- Documentazione completa con README e guide di configurazione
- Server Express.js per gestire le API backend
- Gestione errori robusta e timeout configurabili
- Supporto per deployment su Vercel

### Sicurezza
- Variabili d'ambiente per proteggere le chiavi API
- Validazione input lato server
- CORS configurato per sicurezza in produzione

### Note
- Prima release pubblica del progetto Aiko
- Testato con Node.js 18+ e browser moderni con supporto WebRTC 