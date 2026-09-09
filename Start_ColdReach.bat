@echo off
echo ============================================
echo   Starting ColdReach...
echo ============================================
echo.

:: ── Project root (edit this if you move the project) ──
set PROJECT_DIR=g:\ai_job_search\linkedin-auto-apply

:: ── 1. Kill any existing servers on ports 8000 and 5173 ──
echo [1/5] Stopping any existing instances...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING" 2^>nul') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING" 2^>nul') do taskkill /f /t /pid %%a >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: ── 2. Start the backend (uvicorn + FastAPI) ──
echo [2/5] Starting backend server on port 8000...
cd /d %PROJECT_DIR%
start "ColdReach Backend" /MIN cmd /k "python -m uvicorn server:app --reload --port 8000"

:: ── 3. Wait for the backend to boot ──
echo [3/5] Waiting for backend to be ready...
ping 127.0.0.1 -n 5 >nul

:: ── 4. Start the frontend (Vite) ──
echo [4/5] Starting frontend dev server on port 5173...
cd /d %PROJECT_DIR%\frontend
start "ColdReach Frontend" /MIN cmd /k "npm run dev"

:: ── 5. Wait for Vite to compile, then open browser ──
echo [5/5] Waiting for frontend to compile...
ping 127.0.0.1 -n 4 >nul

start http://localhost:5173

echo.
echo ============================================
echo   ColdReach is now running!
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ============================================
echo.
echo You can safely close this window.
echo The servers are running minimized in the background.
echo.
pause
