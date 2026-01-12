# Expert Agent Platform - Infrastructure

This directory contains the Pulumi Infrastructure-as-Code (IaC) for the Expert Agent Platform.

## Overview

The infrastructure is organized by environment:

- **dev** (`expert-ai-dev`) - Development environment, auto-deployed from `dev` branch
- **beta** (`expert-ai-beta`) - Staging environment, deployed on `beta-*` tags
- **gamma** (`expert-ai-gamma`) - Pre-production/load test environment, deployed on `gamma-*` tags
- **prod** (`expert-ai-prod`) - Production environment, deployed on `prod-*` tags with manual approval
- **root** (`expert-ai-root`) - Shared resources (Artifact Registry, CI service accounts)

## Prerequisites

1. **Pulumi CLI**: Install from https://www.pulumi.com/docs/get-started/install/
2. **Python 3.9+**: Required for Pulumi Python runtime
3. **GCP CLI**: `gcloud` authenticated with appropriate permissions
4. **GCS Bucket**: State stored in `gs://expert-ai-pulumi-state` (GCP-native, no Pulumi Cloud needed)

## Setup

```bash
# Navigate to infra directory
cd infra

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Login to GCS backend (NOT Pulumi Cloud)
export PULUMI_BACKEND_URL=gs://expert-ai-pulumi-state
pulumi login

# Initialize stacks (one-time setup)
pulumi stack init dev
pulumi stack init beta
pulumi stack init gamma
pulumi stack init prod
```

## Configuration

Each environment has a `Pulumi.<env>.yaml` configuration file. Set secrets using:

```bash
# Set database password (required)
pulumi config set --secret db_password "your-secure-password" --stack dev

# Repeat for other environments
pulumi config set --secret db_password "your-secure-password" --stack beta
pulumi config set --secret db_password "your-secure-password" --stack gamma
pulumi config set --secret db_password "your-secure-password" --stack prod
```

## Deploying Infrastructure

### Development

```bash
pulumi up --stack dev
```

### Beta/Gamma/Prod

```bash
pulumi up --stack beta
pulumi up --stack gamma
pulumi up --stack prod
```

⚠️ **Important**: Production deployments should typically be done via CI/CD, not manually.

## Resources Created

For each environment, the following resources are provisioned:

| Resource                      | Description                                       |
| ----------------------------- | ------------------------------------------------- |
| **Cloud SQL (PostgreSQL 15)** | Primary database                                  |
| **GCS Buckets**               | User uploads, session summaries                   |
| **Service Account**           | Cloud Run identity with least-privilege           |
| **Secret Manager Secrets**    | Database URL, OAuth credentials, Stripe keys      |
| **Pub/Sub Topics**            | Async processing (summarization, file processing) |
| **Cloud Scheduler Jobs**      | Periodic memory summarization                     |
| **Artifact Registry**         | Docker images (in root project only)              |

## CI/CD Integration

The infrastructure is deployed via GitHub Actions:

1. **Infrastructure changes** are detected and applied via a separate Pulumi workflow
2. **Application deployments** use Cloud Build to deploy to Cloud Run

### Manual Deployment (Emergency Only)

```bash
# Preview changes
pulumi preview --stack prod

# Apply changes (requires manual confirmation)
pulumi up --stack prod
```

## Outputs

After deployment, view outputs:

```bash
pulumi stack output --stack dev
```

Key outputs:

- `sql_connection_name`: Cloud SQL connection string
- `uploads_bucket`: GCS bucket for user uploads
- `cloud_run_sa_email`: Service account for Cloud Run

## Destroying Infrastructure

⚠️ **Caution**: This will delete all resources including databases!

```bash
# Destroy dev environment (for cleanup)
pulumi destroy --stack dev

# Production has deletion protection enabled
```

## Troubleshooting

### API Not Enabled

If you see API errors, enable the required APIs:

```bash
gcloud services enable run.googleapis.com --project=expert-ai-dev
```

### Permission Denied

Ensure your GCP account has Owner or Editor role on the project.

### State Lock Errors

Clear locks if a previous operation failed:

```bash
pulumi cancel --stack dev
```
\n# Triggered: Mon Jan 12 00:49:29 PST 2026
\n# APIs pre-enabled via gcloud: Mon Jan 12 00:55:23 PST 2026
\n# SQL Admin API enabled in root: Mon Jan 12 00:57:42 PST 2026
\n# IAM admin permission granted: Mon Jan 12 01:55:57 PST 2026
