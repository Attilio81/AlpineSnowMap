@echo off
echo AlpineSnowMap — Setup e avvio...
echo.

cd /d "%~dp0backend"

:: Crea venv se non esiste
if not exist ".venv\Scripts\activate" (
    echo [1/3] Creazione ambiente virtuale...
    python -m venv .venv
    if errorlevel 1 (
        echo ERRORE: python non trovato. Installa Python 3.11+ e riprova.
        pause
        exit /b 1
    )
)

:: Installa dipendenze se necessario
echo [2/3] Installazione dipendenze backend...
.venv\Scripts\python.exe -m pip install -q -r requirements.txt
if errorlevel 1 (
    echo ERRORE: pip install fallito. Controlla requirements.txt.
    pause
    exit /b 1
)

echo [3/3] Avvio backend e frontend...
echo.

:: Avvia backend (venv già presente e aggiornato)
start "AlpineSnowMap Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000"

:: Aspetta che il backend sia pronto
timeout /t 3 /nobreak > nul

:: Avvia frontend
start "AlpineSnowMap Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:   http://localhost:8000
echo Frontend:  http://localhost:5173
echo API docs:  http://localhost:8000/docs
echo.
echo Premi un tasto per chiudere questa finestra...
pause > nul
