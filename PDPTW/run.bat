@echo off
setlocal enabledelayedexpansion

REM PDPTW Visualizer - Windows Setup and Run Script
REM This script sets up and runs both frontend and backend on Windows

echo.
echo [94m[INFO][0m Starting PDPTW Visualizer Setup...
echo ================================================

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [91m[ERROR][0m Python is not installed or not in PATH
    pause
    exit /b 1
) else (
    echo [92m[SUCCESS][0m Python found
)

REM Check pip
pip --version >nul 2>&1
if errorlevel 1 (
    echo [91m[ERROR][0m pip is not installed
    pause
    exit /b 1
) else (
    echo [92m[SUCCESS][0m pip found
)

REM Setup backend
echo.
echo [94m[INFO][0m Setting up backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [94m[INFO][0m Creating Python virtual environment...
    python -m venv venv
    echo [92m[SUCCESS][0m Virtual environment created
)

REM Activate virtual environment
echo [94m[INFO][0m Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo [94m[INFO][0m Installing Python dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo [91m[ERROR][0m Failed to install dependencies
    pause
    exit /b 1
)
echo [92m[SUCCESS][0m Backend dependencies installed

REM Check algorithm executables
echo [94m[INFO][0m Checking algorithm executables...
set ALGO_DIR=..\RELEASE
if exist "%ALGO_DIR%\PDPTW_ACO.exe" (
    echo [92m[SUCCESS][0m Found: PDPTW_ACO.exe
) else (
    echo [93m[WARNING][0m Missing: PDPTW_ACO.exe
)

if exist "%ALGO_DIR%\PDPTW_GREEDY_INSERTION.exe" (
    echo [92m[SUCCESS][0m Found: PDPTW_GREEDY_INSERTION.exe
) else (
    echo [93m[WARNING][0m Missing: PDPTW_GREEDY_INSERTION.exe
)

if exist "%ALGO_DIR%\PDPTW_HYBRID_ACO_GREEDY_V3.exe" (
    echo [92m[SUCCESS][0m Found: PDPTW_HYBRID_ACO_GREEDY_V3.exe
) else (
    echo [93m[WARNING][0m Missing: PDPTW_HYBRID_ACO_GREEDY_V3.exe
)

REM Start backend server
echo [94m[INFO][0m Starting backend server on port 5000...
start "PDPTW Backend" cmd /k "call venv\Scripts\activate.bat && python app.py"

REM Wait for backend to start
timeout /t 5 /nobreak >nul

REM Test backend connection
echo [94m[INFO][0m Testing backend connection...
curl -f http://localhost:5000/api/health >nul 2>&1
if errorlevel 1 (
    echo [93m[WARNING][0m Backend may not be ready yet, continuing...
) else (
    echo [92m[SUCCESS][0m Backend is responding
)

REM Setup frontend
cd ..\frontend
echo [94m[INFO][0m Setting up frontend...

REM Start frontend server
echo [94m[INFO][0m Starting frontend server on port 8080...

REM Try different server options
where /q npx
if not errorlevel 1 (
    start "PDPTW Frontend" cmd /k "npx http-server -p 8080 -c-1 --cors"
    echo [92m[SUCCESS][0m Frontend server started with http-server
) else (
    start "PDPTW Frontend" cmd /k "python -m http.server 8080"
    echo [92m[SUCCESS][0m Frontend server started with Python http.server
)

REM Wait for frontend to start
timeout /t 3 /nobreak >nul

REM Create stop script
echo @echo off > ..\stop.bat
echo echo [94m[INFO][0m Stopping PDPTW Visualizer... >> ..\stop.bat
echo taskkill /f /fi "WindowTitle eq PDPTW Backend*" >> ..\stop.bat
echo taskkill /f /fi "WindowTitle eq PDPTW Frontend*" >> ..\stop.bat
echo echo [92m[SUCCESS][0m All servers stopped >> ..\stop.bat
echo pause >> ..\stop.bat

REM Print success message
echo.
echo ================================================
echo [92m[SUCCESS][0m PDPTW Visualizer is now running!
echo.
echo [96mBackend API:[0m  http://localhost:5000
echo [96mFrontend App:[0m http://localhost:8080
echo.
echo [96mTo stop the servers:[0m
echo   stop.bat
echo.
echo [96mDocumentation:[0m
echo   Backend:  backend\README.md
echo   Frontend: frontend\README.md
echo ================================================

REM Auto-open browser
start http://localhost:8080

echo.
echo [94m[INFO][0m Servers are running in separate windows
echo [94m[INFO][0m Close this window or press any key to exit setup
pause >nul
