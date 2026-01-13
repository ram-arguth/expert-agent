#!/bin/bash
# =============================================================================
# Expert Agent Platform - Environment Bootstrap Script
# =============================================================================
# 
# This script performs all one-time bootstrap operations for a new environment.
# Run this ONCE per environment when setting up the platform.
#
# Usage: ./scripts/bootstrap-env.sh <environment>
#        ./scripts/bootstrap-env.sh dev
#        ./scripts/bootstrap-env.sh beta
#        ./scripts/bootstrap-env.sh gamma
#        ./scripts/bootstrap-env.sh prod
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated with owner permissions
#   2. Billing enabled on the target project
#   3. Root project (expert-ai-root) already set up with:
#      - Pulumi state bucket (gs://expert-ai-pulumi-state)
#      - Pulumi config passphrase secret (pulumi-config-passphrase)
#
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_PROJECT="expert-ai-root"
REGION="us-west1"
PULUMI_STATE_BUCKET="gs://expert-ai-pulumi-state"

# Validate arguments
if [ $# -ne 1 ]; then
  echo -e "${RED}Error: Environment argument required${NC}"
  echo "Usage: $0 <environment>"
  echo "  Environments: dev, beta, gamma, prod"
  exit 1
fi

ENV="$1"

# Get project ID for environment
case "$ENV" in
  dev)   PROJECT_ID="expert-ai-dev" ;;
  beta)  PROJECT_ID="expert-ai-beta" ;;
  gamma) PROJECT_ID="expert-ai-gamma" ;;
  prod)  PROJECT_ID="expert-ai-prod-484103" ;;
  *)
    echo -e "${RED}Error: Invalid environment '$ENV'${NC}"
    echo "  Valid environments: dev, beta, gamma, prod"
    exit 1
    ;;
esac

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Bootstrapping environment: ${ENV}${NC}"
echo -e "${BLUE}Project ID: ${PROJECT_ID}${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Enable required APIs (must happen BEFORE Cloud Build can run)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 1: Enabling required APIs...${NC}"

REQUIRED_APIS=(
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "sqladmin.googleapis.com"
  "compute.googleapis.com"
  "storage.googleapis.com"
  "aiplatform.googleapis.com"
  "secretmanager.googleapis.com"
  "cloudscheduler.googleapis.com"
  "logging.googleapis.com"
  "monitoring.googleapis.com"
  "pubsub.googleapis.com"
  "iam.googleapis.com"
  "artifactregistry.googleapis.com"
  "dns.googleapis.com"
  "cloudresourcemanager.googleapis.com"
)

for api in "${REQUIRED_APIS[@]}"; do
  echo "  Enabling $api..."
  gcloud services enable "$api" --project="$PROJECT_ID" --quiet
done

echo -e "${GREEN}✓ APIs enabled${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Create cloud-build-infra service account
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 2: Creating cloud-build-infra service account...${NC}"

SA_EMAIL="cloud-build-infra@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if SA exists
if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &>/dev/null; then
  echo "  Service account already exists"
else
  gcloud iam service-accounts create cloud-build-infra \
    --project="$PROJECT_ID" \
    --display-name="Cloud Build Infrastructure Deployer" \
    --quiet
  echo "  Service account created"
fi

echo -e "${GREEN}✓ Service account ready: $SA_EMAIL${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 3: Grant IAM permissions to cloud-build-infra SA
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 3: Granting IAM permissions...${NC}"

ROLES=(
  "roles/editor"
  "roles/resourcemanager.projectIamAdmin"
  "roles/storage.admin"
  "roles/secretmanager.secretAccessor"
  "roles/logging.logWriter"
  "roles/iam.serviceAccountAdmin"
  "roles/storage.objectViewer"
)

for role in "${ROLES[@]}"; do
  echo "  Granting $role..."
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" \
    --condition=None --quiet 2>/dev/null || true
done

echo -e "${GREEN}✓ IAM permissions granted${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 4: Grant cross-project access to root resources
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 4: Granting access to root project resources...${NC}"

# Access to Pulumi passphrase secret
echo "  Granting access to pulumi-config-passphrase secret..."
gcloud secrets add-iam-policy-binding pulumi-config-passphrase \
  --project="$ROOT_PROJECT" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" --quiet 2>/dev/null || true

# Access to Pulumi state bucket
echo "  Granting access to Pulumi state bucket..."
gsutil iam ch "serviceAccount:$SA_EMAIL:objectAdmin" "$PULUMI_STATE_BUCKET" 2>/dev/null || true

echo -e "${GREEN}✓ Cross-project access granted${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 5: Initialize Pulumi stack (if not exists)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}Step 5: Checking Pulumi stack...${NC}"

STACK_EXISTS=$(gsutil ls "${PULUMI_STATE_BUCKET}/.pulumi/stacks/expert-agent-infra/${ENV}.json" 2>/dev/null && echo "yes" || echo "no")

if [ "$STACK_EXISTS" == "yes" ]; then
  echo "  Pulumi stack '$ENV' already exists"
else
  echo "  Stack does not exist - will be created on first deployment"
  echo "  Run: cd infra && pulumi stack init $ENV"
fi

echo -e "${GREEN}✓ Pulumi stack check complete${NC}"
echo ""

# -----------------------------------------------------------------------------
# Step 6: Print manual steps (cannot be automated)
# -----------------------------------------------------------------------------
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}BOOTSTRAP COMPLETE - MANUAL STEPS REQUIRED${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}The following steps require manual action in GCP Console:${NC}"
echo ""
echo "1. CLOUD BUILD TRIGGERS (one-time per repo):"
echo "   Go to: https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
echo ""
echo "   a. Connect GitHub repository (if not already connected):"
echo "      - Click 'Manage repositories' → 'Link repository'"
echo "      - Select 'GitHub' and authorize Cloud Build GitHub App"
echo "      - Select 'expert-agent' repository"
echo ""
echo "   b. Create trigger for this environment:"
case "$ENV" in
  dev)
    echo "      - Name: dev-push"
    echo "      - Event: Push to branch"
    echo "      - Branch: ^dev$"
    echo "      - Config: cloudbuild.yaml"
    echo ""
    echo "      - Name: dev-infra"
    echo "      - Event: Push to branch"
    echo "      - Branch: ^dev$"
    echo "      - Path filter: infra/**"
    echo "      - Config: cloudbuild-infra.yaml"
    ;;
  beta)
    echo "      - Name: beta-tag"
    echo "      - Event: Push new tag"
    echo "      - Tag: ^beta-.*"
    echo "      - Config: cloudbuild.yaml"
    ;;
  gamma)
    echo "      - Name: gamma-tag"
    echo "      - Event: Push new tag"
    echo "      - Tag: ^gamma-.*"
    echo "      - Config: cloudbuild.yaml"
    ;;
  prod)
    echo "      - Name: prod-tag"
    echo "      - Event: Push new tag"
    echo "      - Tag: ^prod-.*"
    echo "      - Config: cloudbuild.yaml"
    echo "      - IMPORTANT: Enable manual approval for production!"
    ;;
esac
echo ""
echo "   c. Set substitutions for each trigger:"
echo "      - _ENV: $ENV"
echo "      - _PROJECT_ID: $PROJECT_ID"
echo "      - _REGION: $REGION"
echo "      - _SERVICE_NAME: expert-agent"
echo "      - _PULUMI_BACKEND_URL: $PULUMI_STATE_BUCKET"
echo ""
echo "2. DOMAIN VERIFICATION (one-time per domain):"
echo "   Go to: https://search.google.com/search-console"
echo "   - Add property for your domain (e.g., ai-${ENV}.oz.ly)"
echo "   - Verify using DNS TXT record method"
echo "   - After verification, add cloud-build-infra SA as owner"
echo ""
echo -e "${GREEN}Once manual steps are complete, deploy using:${NC}"
echo "   gcloud builds submit --config=cloudbuild-infra.yaml \\"
echo "     --project=$PROJECT_ID --region=$REGION \\"
echo "     --substitutions=\"_ENV=$ENV,_PULUMI_BACKEND_URL=$PULUMI_STATE_BUCKET\" ."
echo ""
echo -e "${GREEN}Or push/tag to trigger automated builds!${NC}"
