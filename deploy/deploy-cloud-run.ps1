$ErrorActionPreference = "Stop"

$PROJECT_ID = if ($env:GCP_PROJECT_ID) { $env:GCP_PROJECT_ID } else { "schoolbusdispatchapp" }
$REGION = if ($env:GCP_REGION) { $env:GCP_REGION } else { "northamerica-northeast1" }
$SERVICE_NAME = "dispatch-api"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " Deploying Dispatch Go API to Google Cloud Run" -ForegroundColor Cyan
Write-Host " Project: $PROJECT_ID | Region: $REGION" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

gcloud config set project $PROJECT_ID

Write-Host "[1/3] Ensuring required Google Cloud APIs are enabled..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $PROJECT_ID

# Deploy container to Cloud Run
# Ensure environment variables are loaded or passed via env-vars-file
$ENV_VARS = "ENV=production,GCP_PROJECT_ID=$PROJECT_ID"
if ($env:HR_NOTIFICATION_EMAIL) { $ENV_VARS += ",HR_NOTIFICATION_EMAIL=$($env:HR_NOTIFICATION_EMAIL)" }
if ($env:SYSTEM_NOTIFICATION_EMAIL) { $ENV_VARS += ",SYSTEM_NOTIFICATION_EMAIL=$($env:SYSTEM_NOTIFICATION_EMAIL)" }
if ($env:SMTP_HOST) { $ENV_VARS += ",SMTP_HOST=$($env:SMTP_HOST)" }
if ($env:SMTP_PORT) { $ENV_VARS += ",SMTP_PORT=$($env:SMTP_PORT)" }
if ($env:SMTP_USERNAME) { $ENV_VARS += ",SMTP_USERNAME=$($env:SMTP_USERNAME)" }
if ($env:SMTP_PASSWORD) { $ENV_VARS += ",SMTP_PASSWORD=$($env:SMTP_PASSWORD)" }
if ($env:SMTP_FROM) { $ENV_VARS += ",SMTP_FROM=$($env:SMTP_FROM)" }
if ($env:APP_BASE_URL) { $ENV_VARS += ",APP_BASE_URL=$($env:APP_BASE_URL)" }

gcloud run deploy $SERVICE_NAME `
  --source ./server `
  --platform managed `
  --region $REGION `
  --allow-unauthenticated `
  --set-env-vars "$ENV_VARS"

if ($LASTEXITCODE -eq 0) {
  Write-Host "[3/3] [SUCCESS] Service deployed to Google Cloud Run!" -ForegroundColor Green
  gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)"
} else {
  Write-Host "[ERROR] Cloud Run deployment encountered an error. Please check the logs above." -ForegroundColor Red
}
