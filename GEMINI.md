---
trigger: always_on
---

# Expert Agent Platform – Workspace Rules

This file defines workspace-specific configuration for AI assistants working in this repository.

- The **global rules** apply unless they conflict with this file.
- This **workspace file overrides** the global file on project-specific matters.
- Safety and platform/system policies always override everything.

---

## 1. Project Overview & Goal

You are working on **Expert Agent Platform**, a multi-tenant AI agent platform for domain-specific expertise.

High-level characteristics:

- **Multi-Tenant SaaS**: Supports Individual, Team, and Enterprise organizations
- **Domain Agnostic**: Pluggable agent architecture for any domain (Legal, UX, Finance, etc.)
- **Gemini 3 Native**: Built exclusively for Gemini 3 Pro via Vertex AI Agent Engine
- **Multimodal**: Supports images, PDFs, text, and structured inputs

Primary value proposition:

- Enable rapid creation of **domain-specific expert agents** by providing:
  - Zod-based input/output schemas
  - Handlebars prompt templating
  - Structured JSON output with Markdown rendering
  - Cedar-based fine-grained authorization
  - Multi-agent chaining (A2A protocol)

**Authoritative Documentation:**

- `docs/DESIGN.md` – The definitive technical design document. All implementation decisions must align with this.
- `docs/IMPEMENTATION.md` – The prioritized implementation checklist derived from DESIGN.md.
- `docs/VISION.md` – High-level product vision and goals.

---

## 2. Technology Stack (MANDATORY)

> **⚠️ These are non-negotiable. Do not suggest alternatives.**

| Category              | Technology                          | Notes                                                         |
| --------------------- | ----------------------------------- | ------------------------------------------------------------- |
| **Frontend**          | Next.js 15 + React 18 + Radix UI    | SSR/SSG, accessible components                                |
| **State Management**  | TanStack Query (React Query)        | Server state caching                                          |
| **Backend**           | Next.js API Routes on Cloud Run     | Serverless Node.js                                            |
| **Database**          | Cloud SQL for PostgreSQL            | Via Prisma ORM                                                |
| **File Storage**      | Google Cloud Storage (GCS)          | Signed URLs for direct uploads                                |
| **AI/LLM**            | Vertex AI Agent Engine + Gemini 3   | `gemini-3-pro-preview`, global endpoint                       |
| **Authorization**     | Cedar Policy Engine                 | Fine-grained RBAC, default-deny                               |
| **Schema Validation** | Zod                                 | Input/Output schemas, A2A-compatible via JSON Schema export   |
| **Prompt Templating** | Handlebars                          | `{{placeholder}}` interpolation                               |
| **Billing**           | Stripe                              | Checkout, Webhooks, Customer Portal                           |
| **IaC**               | Pulumi (Python)                     | All infrastructure as code                                    |
| **CI/CD**             | Cloud Build Triggers                | Sovereign Orchestration: 100% Cloud Build (no GitHub Actions) |
| **Observability**     | OpenTelemetry → Cloud Logging/Trace | W3C TraceContext propagation                                  |
| **Default Region**    | `us-west1`                          | Single-region for dev/beta/gamma; multi-region later for prod |

### 2.1 Latest Stable Libraries Mandate

> **⚠️ ALWAYS use the most modern, industry-standard, and latest stable versions of libraries.**

> [!CAUTION]
> **PREFER MODERN OVER LEGACY**
>
> When selecting or recommending libraries:
>
> 1. **Always choose latest stable versions** – Check npm/PyPI for current versions
> 2. **Prefer modern alternatives** – e.g., pnpm over npm, Vitest over Jest, TanStack Query over Redux
> 3. **Stay current with frameworks** – Use Next.js 15, React 18, Node.js 20 LTS
> 4. **Avoid deprecated patterns** – No class components, no legacy Context API patterns
> 5. **Check maintenance status** – Prefer actively maintained packages with recent commits
>
> **Examples:**
>
> - ✅ `pnpm@9` (fast, efficient, modern)
> - ❌ `npm@6` (legacy)
> - ✅ `vitest` (modern, fast, ESM-first)
> - ❌ `jest` (legacy, slower)
> - ✅ `@tanstack/react-query@5` (latest)
> - ❌ `react-query@3` (outdated)
>
> **Why this matters:**
>
> - Security patches are in latest versions
> - Performance improvements compound
> - Community support is strongest for current versions
> - Reduces technical debt accumulation

---

## 3. Infrastructure & Deployment Rules

### 3.1 CI/CD-First Infrastructure Policy (CARDINAL RULE)

> **⚠️ MANDATORY: All infrastructure changes MUST go through CI/CD.**
>
> This is the **CARDINAL RULE** of this project. Manual deployments are prohibited except for one-time bootstrap operations.

> [!CAUTION]
> **CI/CD-FIRST IS NON-NEGOTIABLE**
>
> Every infrastructure change MUST follow this principle:
>
> 1. **Define all resources in Pulumi IaC FIRST** – Never create resources manually
> 2. **Deploy ONLY via CI/CD pipelines** – Cloud Build Triggers (not GitHub Actions)
> 3. **NEVER run `pulumi up` locally on production stacks** – Use CI/CD
> 4. **NEVER run ad-hoc `gcloud` commands for deployments** – Define in IaC
> 5. **NEVER modify production resources via GCP Console** – Causes drift
>
> **The ONLY Exception: One-Time Bootstrap Operations**
>
> Some operations are foundational and CANNOT be automated because they set up the CI/CD system itself.
> These are documented in Section 3.2 and run EXACTLY ONCE per project lifetime.
> After bootstrap, there are NO EXCEPTIONS to the CI/CD-first policy.

| Action                    | Allowed Method                                                  | Prohibited                      |
| ------------------------- | --------------------------------------------------------------- | ------------------------------- |
| **GCP resource creation** | Pulumi via CI/CD                                                | `gcloud` commands, Console UI   |
| **Secret updates**        | Pulumi or Secret Manager API via CI                             | Manual console edits            |
| **Cloud Run deploys**     | Cloud Build triggered by Git tags                               | `gcloud run deploy` locally     |
| **Database migrations**   | CI/CD pipeline step                                             | Manual `prisma migrate` in prod |
| **Infra changes**         | PR to `infra/` → CI runs `pulumi preview` → merge → `pulumi up` | Any ad-hoc changes              |

**Why CI/CD-First Matters:**

- **Auditability**: Every change is tracked in Git history
- **Reproducibility**: Any environment can be recreated from code
- **Safety**: Automated checks prevent misconfigurations
- **Collaboration**: Team members review infrastructure changes via PRs
- **Rollback**: Previous versions can be easily restored
- **Compliance**: Enterprise customers require full audit trails

### 3.2 One-Time Bootstrap Operations (Manual, Run EXACTLY ONCE)

> These commands establish the foundation for CI/CD itself and CANNOT be automated.
> They are run EXACTLY ONCE per project lifetime during initial setup.
> After these complete, ALL subsequent changes MUST go through CI/CD.

**When to run bootstrap:**

- When creating a brand new project/environment from scratch
- When establishing the root project for shared infrastructure

**Bootstrap operations (run in order):**

```bash
# 1. Enable billing on projects (Console only - cannot be automated)
# Go to: https://console.cloud.google.com/billing

# 2. Enable required APIs on root project
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com \
  --project=expert-ai-root

# 3. Create Pulumi state bucket (in root project)
gcloud storage buckets create gs://expert-ai-pulumi-state \
  --project=expert-ai-root \
  --location=us-west1 \
  --uniform-bucket-level-access \
  --public-access-prevention
gcloud storage buckets update gs://expert-ai-pulumi-state --versioning

# 4. Create centralized Pulumi passphrase secret
PASSPHRASE=$(openssl rand -base64 32)
echo -n "$PASSPHRASE" | gcloud secrets create pulumi-config-passphrase \
  --project=expert-ai-root \
  --data-file=-

# 5. Bootstrap each environment (dev, beta, gamma, prod)
for PROJECT in expert-ai-dev expert-ai-beta expert-ai-gamma expert-ai-prod-484103; do
  echo "=== Bootstrapping $PROJECT ==="

  # Create dedicated cloud-build-infra SA
  gcloud iam service-accounts create cloud-build-infra \
    --project=$PROJECT \
    --display-name="Cloud Build Infrastructure Deployer"

  # Grant access to root passphrase secret
  gcloud secrets add-iam-policy-binding pulumi-config-passphrase \
    --project=expert-ai-root \
    --member="serviceAccount:cloud-build-infra@${PROJECT}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" --quiet

  # Grant access to Pulumi state bucket
  gsutil iam ch serviceAccount:cloud-build-infra@${PROJECT}.iam.gserviceaccount.com:objectAdmin \
    gs://expert-ai-pulumi-state

  # Grant storage.objectViewer for Cloud Build source bucket
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:cloud-build-infra@${PROJECT}.iam.gserviceaccount.com" \
    --role="roles/storage.objectViewer" --condition=None --quiet

  # Grant logging.logWriter for build logs
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:cloud-build-infra@${PROJECT}.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter" --condition=None --quiet

  # Enable required APIs
  gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT --quiet

  echo "✅ $PROJECT bootstrapped"
done

# 6. Create initial Pulumi stacks (run once per environment)
cd infra
pulumi login gs://expert-ai-pulumi-state
pulumi stack init dev
pulumi stack init beta
pulumi stack init gamma
pulumi stack init prod

# 7. Enable Cloud Build API on all projects (BEFORE running builds)
# This must happen before any Cloud Build submission
for PROJECT in expert-ai-dev expert-ai-beta expert-ai-gamma expert-ai-prod-484103; do
  gcloud services enable cloudbuild.googleapis.com --project=$PROJECT --quiet
done
```

### 3.2.1 Cloud Build Triggers (One-Time Console Setup)

Cloud Build Triggers cannot be fully automated via IaC because GitHub connection requires OAuth.
This is a **one-time manual setup** per repository:

1. **Go to Cloud Build Console** for each environment project:
   - https://console.cloud.google.com/cloud-build/triggers?project=expert-ai-dev
   - https://console.cloud.google.com/cloud-build/triggers?project=expert-ai-beta
   - etc.

2. **Connect Repository** (first time only):
   - Click "Manage repositories" → "Link repository"
   - Select "GitHub" and authorize Cloud Build GitHub App
   - Select `expert-agent` repository

3. **Create Triggers**:

   | Project         | Trigger Name | Event          | Filter                       | Config File             |
   | --------------- | ------------ | -------------- | ---------------------------- | ----------------------- |
   | expert-ai-dev   | dev-push     | Push to branch | `^dev$`                      | `cloudbuild.yaml`       |
   | expert-ai-dev   | dev-infra    | Push to branch | `^dev$` + path `infra/**`    | `cloudbuild-infra.yaml` |
   | expert-ai-beta  | beta-tag     | Push new tag   | `^beta-.*`                   | `cloudbuild.yaml`       |
   | expert-ai-beta  | beta-infra   | Push new tag   | `^beta-.*` + path `infra/**` | `cloudbuild-infra.yaml` |
   | expert-ai-gamma | gamma-tag    | Push new tag   | `^gamma-.*`                  | `cloudbuild.yaml`       |
   | expert-ai-prod  | prod-tag     | Push new tag   | `^prod-.*`                   | `cloudbuild.yaml`       |

4. **Set Substitutions** for each trigger:
   - `_ENV`: dev/beta/gamma/prod (matching the project)
   - `_PROJECT_ID`: The project ID
   - `_REGION`: us-west1

**After triggers are set up:**

- Push to `dev` branch → auto-deploys to expert-ai-dev
- Tag `beta-*` on `main` → auto-deploys to expert-ai-beta
- No more manual `gcloud builds submit` needed!

**After bootstrap, ALL subsequent changes go through CI/CD. No exceptions.**

### 3.3 Environment Promotion Strategy

```
dev branch push              → expert-ai-dev (auto-deploy)
beta-YYYYmmdd-HHMMss tag     → expert-ai-beta (auto-deploy + E2E tests)
gamma-YYYYmmdd-HHMMss tag    → expert-ai-gamma (auto-deploy + E2E tests)
prod-YYYYmmdd-HHMMss tag     → expert-ai-prod (manual approval + E2E tests)
```

### 3.4 Branch and Tag Conventions

- **`main`**: Protected. Squash-merged only. Always deployable.
- **`dev`**: Active development. Auto-deploys to expert-ai-dev.
- **`beta-YYYYMMDD`**: Tag format for beta promotion.
- **`gamma-YYYYMMDD`**: Tag format for gamma promotion.
- **`prod-YYYYMMDD`**: Tag format for production promotion.

### 3.5 Service Account and Least-Privilege Principles

> **⚠️ HARD REQUIREMENT:** Never use default service accounts. Always use dedicated SAs with least-privilege permissions.

> [!CAUTION]
> **DEDICATED SERVICE ACCOUNTS ONLY**
>
> - **NEVER use** `PROJECT_NUMBER-compute@developer.gserviceaccount.com` (Compute Engine default)
> - **NEVER use** `PROJECT_NUMBER@cloudbuild.gserviceaccount.com` for production workloads
> - **ALWAYS create** dedicated service accounts for each workload (e.g., `expert-agent-sa`, `cloud-build-deployer`)
> - **ALWAYS apply** least-privilege: grant only the minimum permissions required
> - **ALWAYS define** IAM grants in Pulumi IaC, never via ad-hoc `gcloud` commands

| Workload    | Service Account                                     | Permissions                                      |
| ----------- | --------------------------------------------------- | ------------------------------------------------ |
| Cloud Run   | `expert-agent-sa@PROJECT.iam.gserviceaccount.com`   | `run.invoker`, database access, GCS              |
| App Build   | `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`     | `artifactregistry.writer`, `run.admin`           |
| Infra Build | `cloud-build-infra@PROJECT.iam.gserviceaccount.com` | `editor`, `projectIamAdmin`, state bucket access |

**Why This Matters:**

- **Security**: Default SAs have over-broad permissions
- **Auditability**: Know exactly what each service can do
- **Blast radius**: Compromise of one SA doesn't affect others
- **Compliance**: Enterprise requirements mandate least-privilege

**IAM Grants in IaC:**

All IAM bindings MUST be defined in `infra/__main__.py`:

```python
# Example: Grant Cloud Build SA permission to deploy to Cloud Run
gcp.projects.IAMBinding(
    "cloud-build-run-admin",
    project=project_id,
    role="roles/run.admin",
    members=[pulumi.Output.concat("serviceAccount:", cloud_build_sa.email)],
)
```

---

## 4. Coding Standards

### 4.1 Mandatory Gemini 3 Model Requirement

> **⚠️ HARD REQUIREMENT:** ALL AI operations MUST use Gemini 3 Pro.

> [!CAUTION]
> **ALWAYS USE GEMINI 3 PRO.**
>
> - **Model name**: `gemini-3-pro-preview`
> - **Flash variant**: `gemini-3-flash-preview` (for lightweight operations only)
> - **Location**: `global` (NOT regional endpoints for Gemini 3 preview)
> - **NEVER use**: Gemini 2.x, Gemini 1.5, or older models
>
> **What is NEVER acceptable:**
>
> - Using `gemini-2.5-pro` or any 2.x version
> - Using `gemini-1.5-pro` or any 1.x version
> - Falling back to older models "because they work"
> - Testing with older models and shipping
> - Using `us-central1` or other regional endpoints for Gemini 3
>
> **Why this matters:**
>
> - Gemini 3 provides superior reasoning, multimodal, and context capabilities
> - Model behavior differs significantly between versions
> - Testing on older models creates false confidence
> - Regional endpoints return 404 for Gemini 3 preview models

### 4.2 Authorization Coverage

> **⚠️ MANDATORY:** Every API route MUST call Cedar for authorization.

- All routes must use `withAuthZ()` wrapper or explicit `cedar.isAuthorized()` call.
- Public routes must be listed in `authz-exceptions.json`.
- CI runs `pnpm test:authz-coverage` to enforce this.

### 4.3 Shared Component Usage

- UI components should use shared Radix UI primitives from `packages/ui/`.
- Avoid raw HTML elements (`<button>`, `<input>`, etc.) in component files.
- CI runs `pnpm test:component-usage` (warning-only, not blocking).

### 4.4 Production-Ready Code Policy (No Placeholders)

> **⚠️ HARD REQUIREMENT:** No placeholder or stub code allowed.

> [!CAUTION]
> **NEVER write placeholder or shortcut code.**
>
> - Every function must be fully implemented
> - No `// TODO: implement later` comments
> - No mocked/stubbed functionality in production code
> - If a feature is too complex, split into smaller complete pieces

### 4.5 Mandatory Testing Requirements

| Change Type            | Unit Tests | Integration Tests | E2E Tests      |
| :--------------------- | :--------- | :---------------- | :------------- |
| New API route          | Required   | Required          | If user-facing |
| New agent type         | Required   | Required          | If user-facing |
| Prompt template change | Required   | Required          | Required       |
| Library utility        | Required   | If API-related    | -              |
| Bug fix                | Required   | If API-related    | If UI-related  |

**AI Call Mocking:** All tests MUST mock Vertex AI/Gemini API calls to avoid costs.

---

## 5. Implementation Guide (DESIGN.md → IMPLEMENTATION.md Alignment)

> This section provides expert guidance for implementing features from `docs/IMPEMENTATION.md`
> while ensuring alignment with `docs/DESIGN.md`.

### 5.1 Implementation Phase Order

**ALWAYS follow this phase order from IMPLEMENTATION.md:**

1. **Phase 0: Infrastructure & CI/CD** – Foundation first
2. **Phase 1: Identity & AuthZ** – Security before features
3. **Phase 2: Agent Catalog & Schemas** – Core data model
4. **Phase 3: Query Flow & File Handling** – AI integration
5. **Phase 4: Frontend UI** – User experience
6. **Phase 5: Billing & Subscriptions** – Monetization
7. **Phase 6: Advanced UX** – Polish
8. **Phase 7: Testing & Launch** – Production readiness

### 5.2 Agent Architecture Pattern

Every agent follows this structure from DESIGN.md:

```
packages/agents/{agent-name}/
├── input-schema.ts      # Zod schema for inputs
├── output-schema.ts     # Zod schema for outputs
├── prompt.hbs           # Handlebars prompt template
├── renderer.ts          # JSON → Markdown renderer
└── config.ts            # Agent metadata
```

**Implementation Flow:**

1. Frontend renders dynamic form from `inputSchema` (using react-hook-form + Zod)
2. Backend validates input with Zod
3. Files uploaded to GCS, get signed URLs
4. Handlebars interpolates values into `prompt.hbs`
5. Vertex AI Agent Engine processes prompt with JSON output mode
6. Response validated against `outputSchema`
7. `renderer.ts` converts JSON → Markdown for display

**Example Input Schema (from DESIGN.md):**

```typescript
// packages/schemas/src/agents/legal-advisor/input.ts
import { z } from "zod";

export const LegalAdvisorInputSchema = z.object({
  jurisdiction: z.enum(["US", "UK", "EU"]).describe("Legal jurisdiction"),
  contractType: z.string().min(1).describe("Type of contract"),
  primaryContract: z.instanceof(File).describe("Main contract PDF"),
  supportingDocuments: z.array(z.instanceof(File)).optional(),
  additionalContext: z.string().optional(),
});
```

### 5.3 Cedar Authorization Pattern

Every API route MUST be protected:

```typescript
// lib/authz/withAuthZ.ts
export function withAuthZ(action: string) {
  return async (req: NextRequest, context: { params: Promise<Params> }) => {
    const session = await getSession();
    if (!session) return unauthorized();

    const resource = await resolveResource(context);
    const decision = await cedar.isAuthorized({
      principal: { type: "User", id: session.userId },
      action: { type: "Action", id: action },
      resource: resource,
    });

    if (!decision.isAuthorized) return forbidden();

    return executeHandler(req, context);
  };
}

// Usage in route.ts
export const GET = withAuthZ("ReadAgent")(async (req, { params }) => {
  // Handler implementation
});
```

### 5.4 Multi-Tenant Data Access Pattern

**ALWAYS filter by tenant context:**

```typescript
// Every database query MUST include tenant filtering
const files = await prisma.file.findMany({
  where: {
    OR: [{ userId: session.userId }, { orgId: session.activeOrgId }],
  },
});
```

### 5.5 Token Quota Enforcement Pattern

```typescript
// Pre-query check (before calling AI)
const hasQuota = await checkTokenQuota(session.userId, estimatedTokens);
if (!hasQuota)
  return NextResponse.json({ error: "Quota exceeded" }, { status: 402 });

// Post-query deduction (after AI response)
await deductTokens(session.userId, response.usage.totalTokens);
```

### 5.6 Structured Output Pattern (A2A-Compatible)

```typescript
// 1. Define output schema
const OutputSchema = z.object({
  findings: z.array(FindingSchema),
  recommendations: z.array(RecommendationSchema),
});

// 2. Configure Gemini for structured output
const response = await client.generateContent({
  contents: [{ role: "user", parts: [{ text: assembledPrompt }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: zodToJsonSchema(OutputSchema),
  },
});

// 3. Validate response
const parsed = OutputSchema.parse(JSON.parse(response.text()));

// 4. Render to Markdown
const markdown = renderToMarkdown(parsed);
```

### 5.7 Prompt Template Pattern (Handlebars)

```handlebars
{{! packages/agents/legal-advisor/prompt.hbs }}
You are a legal expert AI specializing in
{{jurisdiction}}
contract law. IMPORTANT: You MUST respond with a valid JSON object matching the
Output Schema. Do NOT include any text outside the JSON object. ## Contract to
Analyze - **Type:**
{{contractType}}
- **Primary Document:**
{{primaryContract.url}}

{{#if supportingDocuments.length}}
  ## Supporting Documents
  {{#each supportingDocuments}}
    -
    {{this.filename}}:
    {{this.url}}
  {{/each}}
{{/if}}

{{#if additionalContext}}
  ## Additional Instructions
  {{additionalContext}}
{{/if}}

{{#if orgContext}}
  ## Organization Context
  {{orgContext}}
{{/if}}
```

---

## 6. Critical Implementation Checklist

When working on this project, verify these are addressed:

### Phase 0: Bootstrap & Infrastructure

- [x] Bootstrap commands run (Section 3.2)
- [x] Pulumi stacks created for all environments
- [x] Cloud Build triggers set up (Sovereign Orchestration)
- [x] Artifact Registry created per environment
- [ ] Cloud Build Triggers connected to GitHub repo
- [ ] Rate limiting and circuit breakers configured
- [ ] CSP headers and input size limits set

### Phase 1: Identity & AuthZ

- [ ] NextAuth configured with Google, Apple, MSA providers
- [ ] Enterprise SSO (SAML/OIDC) via "BYO Identity" pattern
- [ ] Cedar policies loaded for all roles
- [ ] Team invite flow with restricted providers
- [ ] Domain verification for enterprise orgs
- [ ] Workspace switcher with context propagation

### Phase 2: Agent Catalog & Schemas

- [ ] Zod schemas for input/output per agent
- [ ] Handlebars prompt templates
- [ ] Markdown renderers per output schema
- [ ] Agent catalog API with Cedar filtering
- [ ] OmniAgent orchestrator for routing
- [ ] Multi-agent chaining support

### Phase 3: Query Flow

- [ ] GCS signed URL upload flow
- [ ] Prompt assembly with Handlebars
- [ ] Vertex AI Agent Engine integration (global endpoint!)
- [ ] Response validation and storage
- [ ] Session management with 14-day retention
- [ ] Memory summarization job

### Phase 4: Frontend

- [ ] Radix UI component library
- [ ] Dynamic form from Zod schema
- [ ] Chat/Document dual-panel UI
- [ ] Highlight & comment inline feedback
- [ ] Session history and revision view
- [ ] Export (PDF/DOCX) and sharing

### Phase 5: Billing

- [ ] Stripe Checkout integration
- [ ] Webhook handlers for all events
- [ ] Token quota pre/post enforcement
- [ ] Customer portal link
- [ ] Rollover and top-up logic

### Phase 6 & 7: Polish & Launch

- [ ] Admin interfaces (member/context management)
- [ ] Audit logging for enterprise
- [ ] Browser extension (MVP)
- [ ] Security hardening review
- [ ] Load testing in gamma
- [ ] Production smoke tests

---

## 7. Observability Requirements

- **All API routes**: Must be traced with OpenTelemetry
- **AI calls**: Must include `gen_ai.*` span attributes
- **Logs**: Must include `traceId`, `spanId`, `userId`, `orgId`
- **Sampling**: 100% in dev/beta, 1% in prod (always sample errors)
- **W3C TraceContext**: Propagate across frontend → backend → AI services

---

## 8. Security Requirements

- **Cedar default-deny**: No action permitted without explicit policy
- **Tenant isolation**: All data queries filtered by user/org
- **CMEK**: Available for enterprise orgs (Cloud KMS)
- **VPC-SC**: Vertex AI Agent Engine in VPC perimeter
- **CSP headers**: Strict Content-Security-Policy on all responses
- **Rate limiting**: Per-user and per-org limits enforced
- **Circuit breaker**: >$100 spend/hour → auto-suspend + alert

---

## 9. Key Files Reference

| Purpose                  | File                        |
| ------------------------ | --------------------------- |
| Technical Design         | `docs/DESIGN.md`            |
| Implementation Checklist | `docs/IMPEMENTATION.md`     |
| UX Analysis Rules        | `docs/ux-analysis-rules.md` |
| Infrastructure Code      | `infra/__main__.py`         |
| App CI/CD Config         | `cloudbuild.yaml`           |
| Infra CI/CD Config       | `cloudbuild-infra.yaml`     |
| AuthZ Exceptions         | `authz-exceptions.json`     |

---

## 10. Git Branch and Deployment Workflow

> **HARD REQUIREMENT**: Keep `main` branch clean with squash-merged commits only.
> Tags for stage deployments ALWAYS happen on `main` branch, never on `dev`.

### Development Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  feature/* ──┐                                                          │
│              ├──→ dev branch ──→ (squash-merge) ──→ main ──→ tag ──→ β │
│  fix/*     ──┘         │                              │                 │
│                        │                              │                 │
│                        v                              v                 │
│                   auto-deploy                   tag-triggered           │
│                   to expert-ai-dev              deployments             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Branch Rules

| Branch      | Purpose            | Merge Strategy         | Auto-Deploy                |
| ----------- | ------------------ | ---------------------- | -------------------------- |
| `feature/*` | New features       | Merge to `dev`         | No                         |
| `fix/*`     | Bug fixes          | Merge to `dev`         | No                         |
| `dev`       | Active development | Squash-merge to `main` | → `expert-ai-dev`          |
| `main`      | Stable, deployable | Protected, squash-only | Tags trigger stage deploys |

### Stage Deployment Workflow

**Step 1: Develop in `dev` branch**

- All work happens on `dev` or feature branches
- Tight iteration cycles with frequent commits
- Auto-deploys to `expert-ai-dev` on every push

**Step 2: Squash-merge to `main` (before stage deployment)**

```bash
# On main branch
git checkout main
git pull origin main
git merge --squash dev
git commit -m "release: [description of changes]"
git push origin main
```

**Step 3: Tag on `main` for stage deployment**

```bash
# Create tag for target environment (always on main!)
# Format: {env}-YYYYmmdd-HHMMss (timestamp for uniqueness)
TAG="beta-$(date +%Y%m%d-%H%M%S)"
git tag $TAG
git push origin $TAG   # → deploys to expert-ai-beta

# For gamma:
TAG="gamma-$(date +%Y%m%d-%H%M%S)"
git tag $TAG
git push origin $TAG   # → deploys to expert-ai-gamma

# For prod:
TAG="prod-$(date +%Y%m%d-%H%M%S)"
git tag $TAG
git push origin $TAG   # → deploys to expert-ai-prod (requires approval)
```

### What is Acceptable

- ✅ Frequent commits to `dev` branch
- ✅ Feature branches merged to `dev`
- ✅ Tight iteration development on `dev`
- ✅ Squash-merge from `dev` to `main` when ready for stage deployment
- ✅ Tags on `main` branch only

### What is NOT Acceptable

- ❌ Tags on `dev` branch (will not trigger stage deployments)
- ❌ Fast-forward merge to `main` (always squash)
- ❌ Direct commits to `main`
- ❌ Merging to `main` without completing dev testing
- ❌ Skipping `dev` → deploying directly from feature branch to stages

### Tag Format

| Tag Pattern             | Target Environment | Approval | Example                 |
| ----------------------- | ------------------ | -------- | ----------------------- |
| `beta-YYYYmmdd-HHMMss`  | `expert-ai-beta`   | Auto     | `beta-20260112-160000`  |
| `gamma-YYYYmmdd-HHMMss` | `expert-ai-gamma`  | Auto     | `gamma-20260112-160000` |
| `prod-YYYYmmdd-HHMMss`  | `expert-ai-prod`   | Manual   | `prod-20260112-160000`  |

### Why This Pattern

1. **Clean History**: `main` has a clear, readable history of releases
2. **Traceability**: Each tag points to a known-good squashed commit
3. **Easy Rollback**: Revert to previous tag if issues arise
4. **Stage Isolation**: Each environment has its own promotion gate
5. **Audit Trail**: Clear record of what code went to which environment when

---

## 11. Assistant Interaction Preferences

> **⚠️ MANDATORY:** Follow these interaction preferences when working in this repository.

### 11.1 No Browser Usage

- **NEVER use the browser subagent** for GCP console or other web interfaces
- **ALWAYS use CLI tools** instead:
  - `gcloud` for GCP operations (Cloud Build, Cloud Run, IAM, etc.)
  - `pulumi` for infrastructure state queries
  - `curl` for API testing
- This ensures reproducibility and keeps all operations scriptable

### 11.2 CI/CD Status Monitoring

When monitoring Cloud Build:

- **Use short polling intervals** (30-60 seconds) instead of long waits (180+ seconds)
- **Check status more frequently** to provide faster feedback to the user
- **Preferred pattern**:

  ```bash
  # Quick status check
  gcloud builds describe BUILD_ID --project=PROJECT_ID --format="value(status)"

  # List recent builds
  gcloud builds list --project=PROJECT_ID --limit=5 --format="table(id,createTime,status)"

  # Stream logs
  gcloud builds log BUILD_ID --project=PROJECT_ID --stream
  ```

- **Avoid**: Long `WaitDurationSeconds` values (180+) when polling `command_status`
- **Prefer**: 30-60 second intervals with multiple checks

---

## 12. Cloud Build Troubleshooting

### 12.1 Regional Builds

Cloud Build Triggers run in a specific region (usually `us-west1` for this project).

```bash
# List builds in the regional endpoint (where triggers run)
gcloud builds list --project=expert-ai-dev --region=us-west1 --limit=5

# Describe a regional build
gcloud builds describe BUILD_ID --project=expert-ai-dev --region=us-west1

# Note: Builds submitted via gcloud from command line go to global endpoint
gcloud builds list --project=expert-ai-dev --region=global --limit=5
```

### 12.2 Common Build Errors and Fixes

| Error                                                                     | Cause                                                  | Fix                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `key in the template "DATABASE_URL" is not a valid built-in substitution` | Using `${VAR}` where VAR doesn't start with underscore | Use literal values or `_VAR` substitutions |
| `build step depends on "X", which has not been defined`                   | Step references non-existent step ID                   | Update `waitFor` array to correct step IDs |
| `Build does not specify logsBucket, unable to stream logs`                | Build failed before logs bucket configured             | Use `gcloud builds describe` instead       |

### 12.3 Substitution Variable Rules

Cloud Build substitutions have strict naming rules:

```yaml
# ✅ VALID - Built-in variables
- "${PROJECT_ID}"
- "${COMMIT_SHA}"
- "${SHORT_SHA}"
- "${BUILD_ID}"

# ✅ VALID - User-defined (must start with underscore)
- "${_ENV}"
- "${_REGION}"
- "${_SERVICE_NAME}"

# ❌ INVALID - Will cause build to fail
- "${DATABASE_URL}"     # No underscore prefix
- "${MY_VAR}"           # No underscore prefix

# ✅ SOLUTION - Use literal values for env vars
env:
  - "DATABASE_URL=file:./test.db"
  - "NODE_ENV=production"
```

### 12.4 Parallel Steps and Dependencies

When splitting tests into parallel steps, ensure all `waitFor` references are updated:

```yaml
# Before (single step)
- id: "run-tests"
  ...

- id: "build-image"
  waitFor: ["build-app", "run-tests"]  # ❌ run-tests no longer exists

# After (parallel steps)
- id: "test-authz"
  waitFor: ["install-deps"]
- id: "test-unit"
  waitFor: ["install-deps"]
- id: "test-integration"
  waitFor: ["install-deps"]

- id: "build-image"
  waitFor: ["build-app"]  # ✅ Only wait for build

- id: "push-image"
  waitFor: ["build-image", "test-authz", "test-unit", "test-integration"]  # ✅ Wait for all
```

---

## 13. Implementation Progress (Updated 2026-01-13)

### Completed

| Phase   | Feature           | Location                            | Status      |
| ------- | ----------------- | ----------------------------------- | ----------- |
| 1.7     | Workspace Context | `lib/context/workspace-context.tsx` | ✅ 22 tests |
| 2.1-2.4 | UX Analyst Agent  | `lib/agents/ux-analyst/`            | ✅ 60 tests |
| 2.5     | Agent Catalog API | `app/api/agents/`                   | ✅ 8 tests  |
| 3.1     | File Upload API   | `app/api/upload/route.ts`           | ✅ 26 tests |
| 3.3     | Query API         | `app/api/query/route.ts`            | ✅ 15 tests |
| 3.4     | Vertex AI Client  | `lib/vertex/client.ts`              | ✅ 12 tests |

### Test Count: 263 passing

### Dependencies Added

- `@google-cloud/storage` - GCS signed URLs
- `google-auth-library` - Vertex AI authentication
- `handlebars` - Prompt templating
- `uuid` - Unique ID generation
