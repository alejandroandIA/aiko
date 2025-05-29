import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';

// Handlers
import transcribeAudioHandler from './transcribeAudio.js';
import sessionHandler from './session.js';
import saveToMemoryHandler from './saveToMemory.js';
import searchMemoryHandler from './searchMemory.js';
import generateContextSummaryHandler from './generateContextSummary.js';

// Carica le variabili d'ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione multer per gestire l'upload audio
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.raw({ type: 'audio/*', limit: '25mb' }));

// Serve i file statici dalla directory principale
app.use(express.static(join(__dirname, '..')));

// API Routes
app.post('/api/transcribeAudio', upload.none(), async (req, res) => {
  // Converti il middleware Express in formato compatibile con i handler esistenti
  await transcribeAudioHandler(req, res);
});

app.post('/api/session', async (req, res) => {
  await sessionHandler(req, res);
});

app.post('/api/saveToMemory', async (req, res) => {
  await saveToMemoryHandler(req, res);
});

app.get('/api/searchMemory', async (req, res) => {
  await searchMemoryHandler(req, res);
});

app.get('/api/generateContextSummary', async (req, res) => {
  await generateContextSummaryHandler(req, res);
});

// Gestione errori globale
app.use((err, req, res, next) => {
  console.error('Errore server:', err);
  res.status(500).json({
    error: 'Errore interno del server',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`\n🚀 Server Aiko avviato!`);
  console.log(`📡 Backend API: http://localhost:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`\n✅ Endpoints disponibili:`);
  console.log(`   - POST /api/transcribeAudio`);
  console.log(`   - POST /api/session`);
  console.log(`   - POST /api/saveToMemory`);
  console.log(`   - GET  /api/searchMemory`);
  console.log(`   - GET  /api/generateContextSummary`);
  console.log(`\n⚡ Ambiente: ${process.env.NODE_ENV || 'development'}`);
  
  // Verifica configurazione
  const requiredEnvVars = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(`\n⚠️  ATTENZIONE: Variabili d'ambiente mancanti:`);
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log(`\n   Crea un file .env nella directory api/ con queste variabili.`);
  } else {
    console.log(`\n✅ Tutte le variabili d'ambiente sono configurate correttamente.`);
  }
}); 