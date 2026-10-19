#!/usr/bin/env bash
set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"schoolbusdispatchapp"}
REGION=${GCP_REGION:-"northamerica-northeast1"}
SERVICE_NAME="dispatch-api"

echo "======================================================="
echo " Deploying Dispatch Go API to Google Cloud Run"
echo " Project: $PROJECT_ID | Region: $REGION"
echo "======================================================="

# Ensure gcloud is pointing to target project
gcloud config set project "$PROJECT_ID"

# Build & Deploy directly to Cloud Run
gcloud run deploy "$SERVICE_NAME" \
  --source ./server \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "ENV=production,GCP_PROJECT_ID=$PROJECT_ID"

echo "[SUCCESS] Service deployed to Google Cloud Run!"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'
