# Bootstrap Status

Last updated: 2026-01-12T15:13:00-08:00

## ✅ Bootstrap Complete - Sovereign Orchestration Active

All one-time manual bootstrap steps have been executed. **From this point forward, all infrastructure and application changes MUST go through Cloud Build.**

---

## Architecture: Sovereign Orchestration (Cloud Build Only)

This project uses **100% Cloud Build** for all CI/CD:

| CI/CD Type         | Config File             | Trigger                             |
| ------------------ | ----------------------- | ----------------------------------- |
| **Infrastructure** | `cloudbuild-infra.yaml` | Cloud Build Trigger on `infra/**`   |
| **Application**    | `cloudbuild.yaml`       | Cloud Build Trigger on code changes |

**No GitHub Actions are used.** All CI/CD runs entirely within GCP's boundary.

---

## ✅ Verified: All Projects Ready

| Project                 | Billing    | Cloud Build Infra SA                         | Status   |
| ----------------------- | ---------- | -------------------------------------------- | -------- |
| `expert-ai-root`        | ✅ Enabled | N/A (root)                                   | ✅ Ready |
| `expert-ai-dev`         | ✅ Enabled | ✅ `cloud-build-infra@expert-ai-dev`         | ✅ Ready |
| `expert-ai-beta`        | ✅ Enabled | ✅ `cloud-build-infra@expert-ai-beta`        | ✅ Ready |
| `expert-ai-gamma`       | ✅ Enabled | ✅ `cloud-build-infra@expert-ai-gamma`       | ✅ Ready |
| `expert-ai-prod-484103` | ✅ Enabled | ✅ `cloud-build-infra@expert-ai-prod-484103` | ✅ Ready |

---

## ✅ Completed Bootstrap Steps

### Root Project (`expert-ai-root`)

- [x] Enabled APIs: Cloud Build, Artifact Registry, Secret Manager, IAM
- [x] Created Pulumi State Bucket: `gs://expert-ai-pulumi-state`
- [x] Created `pulumi-config-passphrase` secret (centralized for all envs)

### Each Environment Project (dev, beta, gamma, prod)

- [x] Created dedicated `cloud-build-infra` Service Account
- [x] Granted cross-project access to root passphrase secret
- [x] Granted access to Pulumi state bucket
- [x] Enabled required APIs via Pulumi

---

## 🔧 Service Accounts

| Workload                      | Service Account                                       | Purpose                               |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------- |
| **Infrastructure Deployment** | `cloud-build-infra@{project}.iam.gserviceaccount.com` | Pulumi infrastructure via Cloud Build |
| **Application Runtime**       | `expert-agent-sa@{project}.iam.gserviceaccount.com`   | Cloud Run service identity            |
| **Default Cloud Build**       | `{number}@cloudbuild.gserviceaccount.com`             | Application builds only               |

---

## 🔐 CI/CD Flow (Active)

```
Push to dev branch     → Cloud Build Trigger → Deploys to expert-ai-dev (auto)
Tag beta-YYYYMMDD      → Cloud Build Trigger → Deploys to expert-ai-beta (auto + E2E tests)
Tag gamma-YYYYMMDD     → Cloud Build Trigger → Deploys to expert-ai-gamma (auto + E2E tests)
Tag prod-YYYYMMDD      → Cloud Build Trigger → Deploys to expert-ai-prod (manual approval)
```

---

## 📊 GCP Project Details

| Environment   | Project ID              | Project Number |
| ------------- | ----------------------- | -------------- |
| Root (shared) | `expert-ai-root`        | `658385619058` |
| Development   | `expert-ai-dev`         | `908233028666` |
| Beta          | `expert-ai-beta`        | `176343569448` |
| Gamma         | `expert-ai-gamma`       | `937337640142` |
| Production    | `expert-ai-prod-484103` | `8386655776`   |

---

## ⚠️ No Manual Operations

**All bootstrap operations are complete.** Per the CI/CD-First Cardinal Rule in `GEMINI.md`:

- ❌ NO manual `gcloud` commands for resource creation
- ❌ NO manual `pulumi up` on production stacks
- ❌ NO GCP Console resource modifications
- ✅ All changes via PR → Cloud Build pipeline

---

## 🗑️ Deprecated (Removed)

The following legacy systems have been **removed** as part of the Sovereign Orchestration migration:

| Resource                     | Status       | Notes                                 |
| ---------------------------- | ------------ | ------------------------------------- |
| GitHub Actions workflows     | ❌ Deleted   | `.github/workflows/` removed          |
| `github-actions` SA          | 🔒 To Delete | Manual cleanup in `expert-ai-root`    |
| Workload Identity Federation | 🔒 To Delete | `github-pool` in `expert-ai-root`     |
| GitHub repo secrets          | 🔒 To Delete | `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT` |
