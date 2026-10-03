@echo off
echo ===================================================
echo Starting AegisCode Engine Backend on port 8000...
echo ===================================================
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Freeing occupied port 8000 (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
python -m uvicorn services.api.main:app --reload --host 0.0.0.0 --port 8000
pause
