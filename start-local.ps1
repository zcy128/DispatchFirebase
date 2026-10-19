# Start Dispatch Go Backend and Vite Frontend locally connected to Firebase Firestore

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting School Bus Dispatch System locally" -ForegroundColor Cyan
Write-Host "Backend:  Go API Server on http://localhost:8080" -ForegroundColor Green
Write-Host "Frontend: Vite React App on http://localhost:3000" -ForegroundColor Green
Write-Host "Database: Live Google Cloud Firestore (schoolbusdispatchapp)" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# Start Go Backend Server
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$root\server'; Write-Host 'Starting Go API Server...' -ForegroundColor Cyan; .\server.exe"

Start-Sleep -Seconds 2

# Start Vite Frontend Dev Server
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$root\web'; Write-Host 'Starting Vite Frontend...' -ForegroundColor Cyan; npm run dev"

Write-Host "`nBoth services started! Open http://localhost:3000 in your browser." -ForegroundColor Green
