@echo off
echo ========================================================
echo Starting School Bus Dispatch System locally
echo Backend:  Go API Server on http://localhost:8080
echo Frontend: Vite React App on http://localhost:3000
echo Database: Live Google Cloud Firestore (schoolbusdispatchapp)
echo ========================================================

cd /d "%~dp0server"
start "Dispatch Go API Server (:8080)" cmd /k ".\server.exe"

timeout /t 3 /nobreak >nul

cd /d "%~dp0web"
start "Dispatch Web Frontend (:3000)" cmd /k "npm run dev"

echo.
echo Both servers have been launched in separate windows.
echo Open http://localhost:3000 in your browser to test.
