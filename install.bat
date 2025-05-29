@echo off
echo ===================================
echo  Aiko - Script di installazione
echo ===================================
echo.

REM Verifica Node.js
echo Verifica Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js non trovato. Installa Node.js 18+ prima di continuare.
    echo        Visita: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_VERSION=%%a
if %NODE_VERSION% lss 18 (
    echo ERROR: Node.js versione %NODE_VERSION% trovata. Richiesta versione 18+.
    pause
    exit /b 1
)

echo OK: Node.js trovato
node -v
echo.

REM Installa dipendenze backend
echo Installazione dipendenze backend...
cd api
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Installazione dipendenze fallita
    pause
    exit /b 1
)

REM Crea file .env se non esiste
if not exist .env (
    echo.
    echo Creazione file .env...
    (
        echo # OpenAI
        echo OPENAI_API_KEY=your_openai_api_key_here
        echo.
        echo # Supabase
        echo SUPABASE_URL=your_supabase_url_here
        echo SUPABASE_SERVICE_KEY=your_supabase_service_key_here
        echo.
        echo # Server ^(opzionale^)
        echo PORT=3000
        echo NODE_ENV=development
    ) > .env
    echo OK: File .env creato in api\.env
    echo IMPORTANTE: Modifica api\.env con le tue chiavi API!
) else (
    echo OK: File .env esistente
)

cd ..

echo.
echo ===================================
echo  Installazione completata!
echo ===================================
echo.
echo Prossimi passi:
echo    1. Configura le tue chiavi API in api\.env
echo    2. Configura il database Supabase ^(vedi README.md^)
echo    3. Avvia il server con: cd api ^&^& npm start
echo    4. Apri http://localhost:3000 nel browser
echo.
echo Buon divertimento con Aiko!
echo.
pause 