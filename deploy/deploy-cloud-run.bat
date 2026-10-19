@echo off
setlocal
echo =======================================================
echo  Deploying Dispatch Go API to Google Cloud Run
echo  Target: schoolbusdispatchapp (Montreal)
echo =======================================================

where gcloud >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] gcloud CLI is not installed or not in PATH.
    echo Please install Google Cloud SDK or restart your terminal after install:
    echo https://cloud.google.com/sdk/docs/install
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-cloud-run.ps1"
pause
