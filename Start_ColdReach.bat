@echo off
echo Starting ColdReach...
echo Please wait while the backend and frontend servers boot up.

:: 1. Change to the exact project directory
cd /d "g:\ai_job_search\linkedin-auto-apply"

:: 2. Stop existing servers if running to ensure a clean refresh
echo Stopping existing instances on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: 3. Start the backend in a new minimized command window
start "ColdReach Backend" /MIN cmd /k "python -m uvicorn server:app --reload --port 8000"

:: 4. Wait a few seconds for the Python backend to start
ping 127.0.0.1 -n 4 >nul

:: 5. Change to the frontend directory and start Vite in a new minimized command window
cd frontend
start "ColdReach Frontend" /MIN cmd /k "npm run dev"

:: 6. Wait a couple of seconds for Vite to compile
ping 127.0.0.1 -n 3 >nul

:: 6. Open the default web browser exactly to the local server
start http://localhost:5173

echo.
echo ColdReach is now running in your browser! 
echo (You can safely close this black window, the servers are running minimized in the background).
echo.
pause
