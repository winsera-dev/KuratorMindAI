#!/bin/bash

# Configuration
PROJECT_ID="project-dd8617f2-eabd-4715-a8f" 
REGION="asia-southeast1" 
SERVICE_NAME_AGENTS="kuratormind-agents"
SERVICE_NAME_WEB="kuratormind-web"
REPOSITORY="kuratormind"
IMAGE_AGENTS="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME_AGENTS"
IMAGE_WEB="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME_WEB"

echo "🚀 Starting KuratorMind AI Cloud Run Deployment..."

# 1. Deploy Agents (Backend)
echo "📦 Building and deploying Agents Backend..."
cd apps/agents
gcloud builds submit --tag $IMAGE_AGENTS .
gcloud run deploy $SERVICE_NAME_AGENTS \
  --image $IMAGE_AGENTS \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=FALSE"

# Get backend URL
AGENTS_URL=$(gcloud run services describe $SERVICE_NAME_AGENTS --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Agents Backend deployed at: $AGENTS_URL"

# 2. Deploy Web (Frontend)
echo "📦 Building and deploying Web Frontend..."
cd ../web
# Build-time env vars for Next.js - Note: substitutions removed as they weren't in template
gcloud builds submit --tag $IMAGE_WEB .
gcloud run deploy $SERVICE_NAME_WEB \
  --image $IMAGE_WEB \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_AGENT_API_URL=$AGENTS_URL"

WEB_URL=$(gcloud run services describe $SERVICE_NAME_WEB --platform managed --region $REGION --format 'value(status.url)')
echo "✅ Web Frontend deployed at: $WEB_URL"

echo "🎉 Deployment complete!"
echo "-----------------------------------"
echo "Frontend: $WEB_URL"
echo "Backend API: $AGENTS_URL"
echo "-----------------------------------"
echo "Action required: Update Supabase Auth Redirect URLs in dashboard to include $WEB_URL"
