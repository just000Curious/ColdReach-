@echo off
echo Starting ColdReach...
echo Please wait while the backend and frontend servers boot up.

:: 1. Change to the exact project directory
cd /d "g:\ai_job_search\linkedin-auto-apply"

:: 2. Start the backend in a new minimized command window
start "ColdReach Backend" /MIN cmd /k "python -m uvicorn server:app --reload --port 8000"

:: 3. Wait a few seconds for the Python backend to start
timeout /t 3 /nobreak >nul

:: 4. Change to the frontend directory and start Vite in a new minimized command window
cd frontend
start "ColdReach Frontend" /MIN cmd /k "npm run dev"

:: 5. Wait a couple of seconds for Vite to compile
timeout /t 2 /nobreak >nul

:: 6. Open the default web browser exactly to the local server
start http://localhost:5173

echo.
echo ColdReach is now running in your browser! 
echo (You can safely close this black window, the servers are running minimized in the background).
echo.
pause
