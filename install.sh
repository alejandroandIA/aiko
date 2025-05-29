#!/bin/bash

# Aiko - Script di installazione
echo "🤖 Benvenuto nell'installazione di Aiko!"
echo "========================================"

# Verifica Node.js
echo "📦 Verifica Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trovato. Installa Node.js 18+ prima di continuare."
    echo "   Visita: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versione $NODE_VERSION trovata. Richiesta versione 18+."
    exit 1
fi

echo "✅ Node.js $(node -v) trovato"

# Installa dipendenze backend
echo ""
echo "📦 Installazione dipendenze backend..."
cd api
npm install

# Crea file .env se non esiste
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creazione file .env..."
    cat > .env << EOF
# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Supabase
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Server (opzionale)
PORT=3000
NODE_ENV=development
EOF
    echo "✅ File .env creato in api/.env"
    echo "⚠️  IMPORTANTE: Modifica api/.env con le tue chiavi API!"
else
    echo "✅ File .env già esistente"
fi

cd ..

echo ""
echo "🎉 Installazione completata!"
echo ""
echo "📋 Prossimi passi:"
echo "   1. Configura le tue chiavi API in api/.env"
echo "   2. Configura il database Supabase (vedi README.md)"
echo "   3. Avvia il server con: cd api && npm start"
echo "   4. Apri http://localhost:3000 nel browser"
echo ""
echo "Buon divertimento con Aiko! 🚀" 