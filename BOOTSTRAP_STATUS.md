# Bootstrap Status

Last updated: 2026-01-11T20:27:00-08:00

## ✅ Bootstrap Complete!

All one-time manual bootstrap steps have been executed. **From this point forward, all infrastructure changes MUST go through CI/CD.**

---

## ✅ Verified: All Projects Ready

| Project | Billing | SA Access | Status |
|---------|---------|-----------|--------|
| `expert-ai-root` | ✅ Enabled | N/A (root) | ✅ Ready |
| `expert-ai-dev` | ✅ Enabled | ✅ roles/editor | ✅ Ready |
| `expert-ai-beta` | ✅ Enabled | ✅ roles/editor | ✅ Ready |
| `expert-ai-gamma` | ✅ Enabled | ✅ roles/editor | ✅ Ready |
| `expert-ai-prod-484103` | ✅ Enabled | ✅ roles/editor | ✅ Ready |

---

## ✅ Completed Bootstrap Steps

### Root Project (`expert-ai-root`)
- [x] Enabled APIs: Cloud Build, Artifact Registry, Secret Manager, IAM
- [x] Created Workload Identity Pool: `github-pool`
- [x] Created OIDC Provider: `github-provider` (for GitHub Actions)
- [x] Created Service Account: `github-actions@expert-ai-root.iam.gserviceaccount.com`
- [x] Bound WIF to Service Account for repo `arguth/expert-agent`
- [x] Created Artifact Registry: `us-central1-docker.pkg.dev/expert-ai-root/expert-agent`

### Development Project (`expert-ai-dev`)
- [x] Enabled APIs: Cloud Run, Cloud SQL, Cloud Storage, Vertex AI, Secret Manager, Cloud Build
- [x] Granted `github-actions` SA editor access
- [x] Billing enabled

### Beta Project (`expert-ai-beta`)
- [x] Granted `github-actions` SA editor access
- [x] Billing enabled (2026-01-11)

### Gamma Project (`expert-ai-gamma`)
- [x] Granted `github-actions` SA editor access
- [x] Billing enabled (2026-01-11)

### Production Project (`expert-ai-prod-484103`)
- [x] Granted `github-actions` SA editor access (2026-01-11)
- [x] Billing enabled (2026-01-11)

---

## 🔧 GitHub Repository Secrets Required

Add these secrets to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|-------------|-------|
| `WIF_PROVIDER` | `projects/658385619058/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `WIF_SERVICE_ACCOUNT` | `github-actions@expert-ai-root.iam.gserviceaccount.com` |

---

## 📋 Remaining Setup Steps (CI/CD-Based)

All remaining steps can be done via CI/CD or local development:

### 1. Add GitHub Secrets (if not already done)
- Go to: https://github.com/arguth/expert-agent/settings/secrets/actions
- Add `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` from table above

### 2. Initialize Pulumi Stacks
This can be done locally once or via CI/CD:
```bash
cd infra
pulumi login
pulumi stack init dev
pulumi stack init beta
pulumi stack init gamma
pulumi stack init prod
```

### 3. First Deployment
Push to `dev` branch to trigger the CI/CD pipeline:
```bash
git push origin dev
```

---

## 🔐 CI/CD Flow (Active)

```
Push to dev branch     → Deploys to expert-ai-dev (auto)
Tag beta-YYYYMMDD      → Deploys to expert-ai-beta (auto + E2E tests)
Tag gamma-YYYYMMDD     → Deploys to expert-ai-gamma (auto + E2E tests)  
Tag prod-YYYYMMDD      → Deploys to expert-ai-prod (manual approval)
```

---

## 📊 GCP Project Details

| Environment | Project ID | Project Number |
|-------------|------------|----------------|
| Root (shared) | `expert-ai-root` | `658385619058` |
| Development | `expert-ai-dev` | `908233028666` |
| Beta | `expert-ai-beta` | `176343569448` |
| Gamma | `expert-ai-gamma` | `937337640142` |
| Production | `expert-ai-prod-484103` | `8386655776` |

---

## ⚠️ No More Manual Operations

**All bootstrap operations are complete.** Per the CI/CD-First Cardinal Rule in `GEMINI.md`:

- ❌ NO manual `gcloud` commands for resource creation
- ❌ NO manual `pulumi up` on production stacks  
- ❌ NO GCP Console resource modifications
- ✅ All changes via PR → CI/CD pipeline
