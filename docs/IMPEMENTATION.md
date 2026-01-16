# AI Expert Agents Platform MVP – Implementation Checklist

This document provides a prioritized, phase-by-phase implementation checklist aligned with the technical decisions in `DESIGN.md`. Each phase builds on the previous, and tasks are ordered for optimal dependency resolution.

---

## Technology Stack Reference

Before starting, ensure alignment on these **definitive technology choices** from `DESIGN.md`:

| Category              | Technology                          | Notes                                                       |
| --------------------- | ----------------------------------- | ----------------------------------------------------------- |
| **Frontend**          | Next.js + React + Radix UI          | SSR/SSG, accessible components                              |
| **State Management**  | TanStack Query (React Query) / SWR  | Server state; React hooks for local UI state                |
| **Backend**           | Next.js API Routes on Cloud Run     | Serverless Node.js                                          |
| **Database**          | Cloud SQL for PostgreSQL            | Via `pg` or Prisma ORM                                      |
| **File Storage**      | Google Cloud Storage (GCS)          | Signed URLs for uploads                                     |
| **AI/LLM**            | Vertex AI Agent Engine + Gemini 3   | `gemini-3-pro-preview`, global endpoint                     |
| **Authorization**     | Cedar Policy Engine                 | Fine-grained RBAC                                           |
| **Schema Validation** | Zod                                 | Input/Output schemas, A2A-compatible via JSON Schema export |
| **Prompt Templating** | Handlebars                          | `{{placeholder}}` interpolation                             |
| **Billing**           | Stripe                              | Checkout, Webhooks, Customer Portal                         |
| **IaC**               | Pulumi (Python preferred)           | All infra as code                                           |
| **Observability**     | OpenTelemetry → Cloud Logging/Trace | W3C TraceContext propagation                                |

---

## Testing Strategy & Quality Gates

This section defines mandatory testing policies, pre-commit hooks, and automated checks that apply across all phases.

### Current Test Count

> **Last Updated:** 2026-01-16

| Test Type              | Count    | Status                         |
| ---------------------- | -------- | ------------------------------ |
| Unit Tests             | ~1561    | ✅ Passing                     |
| Integration Tests      | ~24      | ✅ Passing                     |
| E2E Tests (Playwright) | ~250     | ⚠️ Non-blocking (features WIP) |
| **Total**              | **1561** | ✅ All passing in CI           |

### Pre-Commit Hooks (Husky)

Pre-commit hooks run the same checks as CI/CD to catch issues early:

- [x] **Configure Husky:** Install `husky` and `lint-staged` for pre-commit hooks
- [x] **Pre-commit checks (must pass before commit):**
  - [x] `pnpm lint` – ESLint with strict rules
  - [x] `pnpm typecheck` – TypeScript compilation check
  - [x] `pnpm test:unit` – Run unit tests (fast, <30s target)
  - [x] `pnpm test:authz-coverage` – Verify all API routes have Cedar calls
  - [x] `pnpm test:component-usage` – Check shared component usage (warning-only)
- [x] **Pre-push checks:**
  - [x] `pnpm test:integration` – Run integration tests (mocked external services)

### AI/LLM Mocking Policy

> **⚠️ MANDATORY:** All tests (unit, integration, E2E) MUST mock Vertex AI/Gemini API calls to avoid costs.

- [x] **Create mock fixtures:** Define realistic agent response fixtures in `__fixtures__/agents/`
- [x] **Mock implementation:** Use `vitest.mock()` or `msw` to intercept Vertex AI client
- [ ] **Golden path suite (optional):** Separate test suite (`test:golden`) for live AI calls with budget controls, run manually or weekly in CI

### E2E Test Principal Security (Defense-in-Depth) ✅

> **⚠️ SECURITY:** E2E tests use "Test Principal Injection" to bypass OAuth while still enforcing AuthZ. This is protected by multiple security layers.

**Implementation:** `lib/test-utils/e2e-middleware.ts`

**Security Layers:**

1. **Environment Check:** Test mode only allowed when `NODE_ENV !== 'production'` (unless `ALLOW_E2E_TEST_MODE=true`)
2. **Secret Verification:** Requires `E2E_TEST_SECRET` header to match configured secret (constant-time comparison)
3. **Principal Validation:** All test principals are validated (structure, email format, memberships)
4. **Session Tagging:** All test sessions have `isTestPrincipal: true` flag
5. **Cedar Policy:** Production Cedar policies **FORBID** all test principals (highest priority policy)
6. **Production Guard Middleware:** Actively rejects requests with test headers in production
7. **Audit Logging:** All test principal usage is logged for security audit

**Implementation Status:**

- [x] `lib/test-utils/e2e-middleware.ts` - Core security middleware
- [x] `lib/test-utils/e2e-middleware.test.ts` - Security tests (all passing)
- [x] Cedar policy `block-test-principals-in-production` - Defense-in-depth
- [x] `lib/authz/cedar.test.ts` - Cedar security tests (5 test principal tests)
- [x] `middleware.ts` - Root Next.js middleware integrating test principal injection
- [x] `__tests__/middleware.test.ts` - Middleware tests (18 tests)
- [x] `lib/auth/session.ts` - Auth utilities integrating E2E with NextAuth
- [x] `lib/auth/__tests__/session.test.ts` - Session utilities tests (17 tests)
- [x] `auth.ts` - Enhanced `auth()` function that automatically checks for test sessions

**Auth Integration Architecture:**∆∆∆

```
Playwright E2E Test
    │ Sends: X-E2E-Test-Principal, X-E2E-Test-Secret headers
    ▼
middleware.ts → extractTestSession()
    │ Validates secret, extracts principal
    │ Sets x-e2e-session in request headers
    ▼
API Route calls auth()
    ▼
auth.ts → getAuthSession()
    │ Checks x-e2e-session header first
    │ Falls back to nextAuthRaw() (NextAuth)
    ▼
Returns session (with isTestPrincipal: true for test sessions)
```

**Key Design Decision:** The `auth()` function from `@/auth` automatically delegates to `getAuthSession()`, which means **all existing API routes work with E2E test principals without any code changes**. The `nextAuthRaw` export provides access to the original NextAuth function when needed.

### Authorization Coverage Check

> **⚠️ MANDATORY:** Every API route MUST call Cedar for authorization. Routes without Cedar calls are flagged as failures.

- [x] **Create `scripts/check-authz-coverage.ts`:**
  ```typescript
  // Scans all files in app/api/**/*.ts
  // Checks each route handler (GET, POST, PUT, DELETE) calls withAuthZ() or cedar.isAuthorized()
  // Outputs: ✅ route has authz, ❌ route missing authz
  // Exit code 1 if any route is missing authz
  ```
- [x] **Exceptions list:** Maintain `authz-exceptions.json` for intentionally public routes (e.g., healthcheck, webhook with signature verification)
- [x] **CI integration:** Run as part of `pnpm test:authz-coverage` in pre-commit and CI

**`scripts/check-authz-coverage.test.ts`**

- [x] Detects route without Cedar call
- [x] Passes route with `withAuthZ()` wrapper
- [x] Passes route with explicit `cedar.isAuthorized()`
- [x] Respects exceptions list
- [x] Fails CI if any uncovered route found

### Shared Component Usage Check

> **⚠️ RECOMMENDED:** UI components should use shared Radix UI primitives from `packages/ui`. Direct HTML elements for common patterns are flagged.

- [x] **Create `scripts/check-component-usage.ts`:**
  ```typescript
  // Scans all files in apps/web/components/**/*.tsx
  // Flags direct usage of: <button>, <input>, <select>, <dialog>, <dropdown>
  // Suggests: use <Button>, <Input>, <Select>, <Dialog>, <DropdownMenu> from @expert-ai/ui
  // Warning (not blocking): components using raw HTML for primitives
  ```
- [x] **Shared component library:** All primitives in `components/ui/` directory
- [x] **CI integration:** Run as part of `pnpm test:component-usage` in pre-commit (warning-only, not blocking)

**`scripts/check-component-usage.test.ts`**

- [x] Flags `<button>` usage in component file
- [x] Passes `<Button>` from shared library
- [x] Flags `<input type="text">` without shared wrapper
- [x] Reports count of violations per file

### Test Pyramid & Coverage Targets

| Test Type            | Scope                                     | Target Coverage | Run In               |
| -------------------- | ----------------------------------------- | --------------- | -------------------- |
| **Unit**             | Functions, hooks, components in isolation | ≥80% lines      | Pre-commit, CI       |
| **Integration**      | API endpoints with mocked externals       | All endpoints   | Pre-push, CI         |
| **E2E (Playwright)** | Critical user flows                       | Core flows only | CI on beta/prod tags |
| **Golden Path**      | Live AI validation                        | Optional        | Manual/Weekly        |

### CI/CD Test Matrix

| Stage         | Tests Run                                          | Blocking?        |
| ------------- | -------------------------------------------------- | ---------------- |
| `dev` push    | Unit, Integration, AuthZ coverage, Component usage | Yes              |
| `beta-*` tag  | All above + E2E (Playwright)                       | Yes              |
| `gamma-*` tag | All above + Manual approval                        | Yes              |
| `prod-*` tag  | All above                                          | Yes              |
| Weekly cron   | Golden path (live AI)                              | No (report only) |

---

## Phase 0: Infrastructure & CI/CD Bootstrapping

**Goal:** Establish foundational cloud infrastructure, development pipeline, and tooling.

**Prerequisites:** GCP organization with billing; domain name; Stripe/Apple Developer/Google Cloud accounts.

### 0.1 Repository & Tooling Setup

- [x] **Initialize Monorepo:** Create repository with structure:
  ```
  /
  ├── apps/
  │   └── web/              # Next.js app (frontend + API routes)
  ├── packages/
  │   ├── schemas/          # Zod schemas (input/output, shared)
  │   ├── agents/           # Agent definitions (prompts, configs)
  │   └── ui/               # Shared Radix UI components
  ├── infra/                # Pulumi IaC
  ├── docs/                 # DESIGN.md, IMPLEMENTATION.md, etc.
  └── cloudbuild.yaml       # CI/CD (Cloud Build)
  ```
- [x] **Branch Strategy:** `main` (squash-merged only), `dev` (active development). Tags: `beta-*`, `gamma-*`, `prod-*` for promotions.
- [x] **Tooling:** Configure ESLint, Prettier, Husky pre-commit hooks. Add `turbo` or `nx` for monorepo task orchestration.
- [x] **Dependencies:** Install core packages:
  - `zod`, `@hookform/resolvers`, `react-hook-form` (schema-driven forms)
  - `handlebars` (prompt templating)
  - `@tanstack/react-query` (server state)
  - `@radix-ui/*` (UI primitives)
  - `@google/genai` (Vertex AI SDK)
  - `@opentelemetry/*` (tracing)
  - `stripe` (billing)

### 0.2 Pulumi Infrastructure-as-Code

- [ ] **GCP Projects:** Define separate projects via Pulumi:
  - `expert-ai-dev`, `expert-ai-beta`, `expert-ai-gamma`, `expert-ai-prod`
  - `expert-ai-root` (shared: Artifact Registry, CI service accounts)
- [ ] **Enable APIs:** Cloud Run, Cloud SQL, Cloud Storage, Vertex AI, Secret Manager, Cloud Build, Cloud Scheduler, Cloud Logging/Monitoring, Pub/Sub.
- [ ] **Cloud SQL (PostgreSQL):** Provision PostgreSQL instance per environment. Enable pgvector extension for embeddings if needed. Configure private IP or authorized networks.
- [ ] **GCS Buckets:** Create buckets for file uploads (`expert-ai-{env}-uploads`) and artifacts (`expert-ai-{env}-artifacts`). Enable default encryption, no public access, CORS for signed URL uploads.
- [ ] **Cloud Run Service:** Define service for Next.js app. Configure:
  - Region, min/max instances (prod: min=1 to avoid cold starts)
  - Memory/CPU (start with 1GB/1 vCPU)
  - Dedicated service account with least privilege
- [ ] **Secret Manager:** Store OAuth secrets (Google, Apple), Stripe API keys, DB credentials. Reference in Cloud Run env vars.
- [ ] **Artifact Registry:** Create Docker repository for container images.
- [ ] **Cloud Scheduler:** Define job for memory summarization (daily, hits internal API endpoint).
- [ ] **Networking:** Ensure Cloud Run can reach Cloud SQL (via VPC connector or public IP with authorized networks). HTTPS enforced.

### 0.3 CI/CD Pipeline (Cloud Build Triggers - Pure GCP)

**Architecture:** Git Push → Cloud Build Trigger → Cloud Build

This project uses **100% Cloud Build** (Sovereign Orchestration) - no GitHub Actions.

- [x] **Connect GitHub to Cloud Build:**
  1. Go to Cloud Build > Triggers in GCP Console
  2. Connect GitHub repository `ram-arguth/expert-agent`
  3. Authorize Cloud Build GitHub App

- [x] **Create Cloud Build Triggers:**
  - **`dev` trigger**: On push to `dev` branch → deploy to `expert-ai-dev` ✅
  - **`beta-*` trigger**: On tag `beta-*` → deploy to `expert-ai-beta` + E2E tests
  - **`gamma-*` trigger**: On tag `gamma-*` → deploy to `expert-ai-gamma` + E2E tests
  - **`prod-*` trigger**: On tag `prod-*` → deploy to `expert-ai-prod` (requires approval)

- [x] **Build Steps (cloudbuild.yaml):**
  1. Install dependencies (pnpm with caching) ✅
  2. Run lint, type-check, unit tests (parallel) ✅
  3. Build Next.js app ✅
  4. Build Docker image, push to Artifact Registry ✅
  5. Deploy to Cloud Run ✅
  6. Run smoke test (health endpoint) ✅
  7. Run E2E tests (Playwright) ✅
  8. Database migrations (TODO: re-enable once database is configured via IaC)

- [ ] **Cross-Project Permissions:**
  - Dev/Beta/Gamma Cloud Build SAs need `artifactregistry.admin` on `expert-ai-root`
  - Dev/Beta/Gamma Cloud Build SAs need `run.admin` on their respective projects

- [ ] **Pulumi Infrastructure:** Cloud Build Trigger for infrastructure changes via `cloudbuild-infra.yaml`

### 0.4 DNS & Domain Configuration

DNS zones are provisioned via Pulumi (CI/CD), but registrar delegation requires manual steps:

- [ ] **Cloud DNS Zones** (via Pulumi - automated):
  - `ai-oz-ly` zone in `expert-ai-prod-484103` for `ai.oz.ly`
  - `ai-gamma-oz-ly` zone in `expert-ai-gamma` for `ai-gamma.oz.ly`
  - `ai-beta-oz-ly` zone in `expert-ai-beta` for `ai-beta.oz.ly`
  - `ai-dev-oz-ly` zone in `expert-ai-dev` for `ai-dev.oz.ly`

- [ ] **Nameserver Delegation** (manual at registrar):
      After Pulumi deploys DNS zones, get NS records from outputs:

  ```bash
  cd infra && pulumi stack output dns_nameservers
  ```

  Then configure at `oz.ly` registrar:
  - `ai` subdomain → prod nameservers
  - `ai-gamma` subdomain → gamma nameservers
  - `ai-beta` subdomain → beta nameservers
  - `ai-dev` subdomain → dev nameservers

- [ ] **Domain Verification** (manual, one-time):
  - Go to [Google Search Console](https://search.google.com/search-console)
  - Add `oz.ly` as a property
  - Verify via DNS TXT record
  - This allows Cloud Run to issue SSL certificates

- [ ] **Cloud Run Domain Mapping** (after Cloud Run service deployed):
  ```bash
  gcloud beta run domain-mappings create \
    --service=expert-agent \
    --domain=ai.oz.ly \
    --region=us-central1 \
    --project=expert-ai-prod-484103
  ```
  (Or integrate into CI/CD)

See [docs/DNS.md](./DNS.md) for detailed documentation.

### 0.5 External Services (Manual Setup)

- [x] **OAuth Clients (Google):** OAuth 2.0 Client ID created for `dev`. Redirect URIs configured. Secrets stored in Secret Manager. See [docs/GOOGLE_SSO_SETUP.md](./GOOGLE_SSO_SETUP.md).
- [ ] **OAuth Clients (Apple):** Create Service ID, generate private key, verify domain. Store in Secret Manager.
- [ ] **OAuth Clients (Microsoft):** Register app in Azure Portal. Configure tenant ID. Store in Secret Manager.
- [ ] **Stripe:** Create account, define Products/Prices for plans (Free, Pro, Enterprise). Get API keys (test + live). Configure webhook endpoint (`/api/stripe/webhook`).
- [ ] **Email Service (Optional):** Set up SendGrid/Mailgun for transactional emails (invites, notifications). Configure SPF/DKIM DNS records.

### 0.6 Cloud Build Optimization

- [x] **High-CPU Machine Type:**
  - Using `E2_HIGHCPU_8` in `cloudbuild.yaml` (E2_HIGHCPU_32 requires quota approval)
  - Verify machine type is applied: `options.machineType: E2_HIGHCPU_8`

- [ ] **Docker Layer Caching (Kaniko):**
  - Replace Docker build with Kaniko executor
  - Configure cache repository: `--cache-repo=${ARTIFACT_REGISTRY}/cache`
  - Set cache TTL: `--cache-ttl=168h` (7 days)
  - Enable compressed caching: `--compressed-caching=true`

- [x] **pnpm Store Caching:**
  - Configured volume mount for pnpm store: `/workspace/.pnpm-store`
  - Set store directory in build steps: `pnpm config set store-dir /workspace/.pnpm-store`

- [x] **Parallel Step Execution:**
  - Tests run parallel with build using `waitFor`
  - Push waits for all tests AND build to complete

- [x] **Disk Size:**
  - Increased disk for larger builds: `options.diskSizeGb: 100`

### 0.5 Observability Foundation

- [x] **Structured Logging:** Pino-based JSON logging implemented in `lib/observability/logger.ts`:
  - Context propagation: `traceId`, `spanId`, `userId`, `orgId`, `agentId`, `sessionId`
  - W3C TraceContext parsing (`parseTraceContext()`) and generation (`generateTraceContext()`)
  - Sensitive field redaction (passwords, tokens, API keys, auth headers)
  - Environment-aware: pretty print in dev, JSON in production
  - 34 tests covering context binding, trace parsing, security redaction
- [x] **OpenTelemetry Setup:** `lib/observability/tracing.ts`:
  - W3C TraceContext propagator for frontend→backend trace correlation
  - Cloud Trace exporter for GCP production environments
  - OTLP exporter for local development/testing
  - Environment-aware sampling: 100% in dev/beta, 1% in prod
  - Span utilities: `withSpan()`, `withSpanSync()`, `setSpanAttributes()`, `addSpanEvent()`
  - Request tracing helper with `withTracing()` wrapper
  - `extractTraceContext()` / `injectTraceContext()` for propagation
  - 33 tests covering configuration, spans, context propagation
- [x] **Metrics:** `lib/observability/metrics.ts`:
  - 16 pre-defined metrics: request (latency, count, error), AI (tokens, latency, error),
    session (active, created), security (blocked, pii_detected), cost, query duration
  - Metric types: counter, gauge, histogram with bucket boundaries
  - High-level helpers: `recordRequest()`, `recordTokenUsage()`, `recordAILatency()`,
    `recordSecurityBlock()`, `recordPIIDetection()`, `recordCost()`
  - Duration measurement: `measureDuration()`, `measureDurationSync()`
  - In-memory storage for dev/test, Cloud Monitoring integration for production
  - 37 tests covering all metric types, helpers, and edge cases
- [ ] **Alerting:** Create Cloud Monitoring alert policies (error rate spike, high latency, quota exhaustion).

### 0.6 Security & Cost Protection Infrastructure

> **Per DESIGN.md:** Critical security and cost guardrails must be established at infrastructure level.

- [ ] **CMEK (Customer-Managed Encryption Keys):** For enterprise orgs requiring it, configure Cloud KMS key rings and enable CMEK for GCS buckets.
- [ ] **VPC Service Controls:** Configure VPC-SC perimeter around Vertex AI Agent Engine to restrict network access to authorized sources only.
- [x] **Content Filtering & Safety (AI Safety Guard):** Multi-layer defense system implemented in `lib/security/ai-safety-guard.ts`:
  - Layer 1: Pattern-based input validation (prompt injection, jailbreak, delimiter injection detection)
  - Layer 2: Output sanitization (model/provider name scrubbing, harmful content filtering)
  - Layer 3: AI-based deep analysis using Gemini 3 Flash (optional, for complex cases)
  - Security event logging (Cloud Logging integration ready)
  - Embedded safety instructions for agent prompts (platform branding enforcement)
  - 98 tests covering all safety patterns, false positive prevention, and edge cases
- [x] **Compliance Guardrails (PII Detection):** `lib/security/pii-detector.ts`:
  - Pattern-based detection: SSN, credit card, email, phone, IP, passport, bank account, medical ID, address
  - Luhn algorithm validation for credit cards
  - Configurable policies: DEFAULT (block critical), STRICT (block all), LENIENT (flag only)
  - Priority-based overlap handling (e.g., medical_id > ssn for MRN:123456789)
  - Audit logging for compliance tracking
  - `guardInputForPII()` and `guardOutputForPII()` for query pipeline integration
  - Redaction support for output sanitization
  - 69 tests covering all PII types, validation, policies, and edge cases
- [x] **Circuit Breaker for Cost:** Implement anomalous usage detection:
  - Threshold: >$100 spend in 1 hour by single user → auto-suspend account + alert admin
  - Per-org daily budget caps with automatic cutoff
  - Real-time cost tracking dashboard for admins
- [x] **Rate Limiting:** Configure per-user and per-org rate limits (e.g., 100 requests/hour free tier, 1000/hour pro).
- [x] **CSP Headers:** Configure strict Content-Security-Policy to mitigate XSS. Disallow inline scripts, allow only trusted CDNs.
- [x] **Input Size Limits:** Enforce file size limits (default 10MB, configurable per plan). Large files route to async processing.

### 0.7 Phase 0 Test Requirements

#### Unit Tests (Vitest/Jest)

**`lib/rate-limiter.test.ts`**

- [x] Allows requests under limit
- [x] Blocks requests over limit
- [x] Resets after time window
- [x] Applies correct limits per tier (free/pro)

**`lib/circuit-breaker.test.ts`**

- [x] Detects spend over threshold
- [x] Triggers alert when threshold exceeded
- [x] Suspends account correctly
- [x] Admin override works

**`lib/input-validator.test.ts`**

- [x] Accepts files under size limit
- [x] Rejects files over size limit
- [x] Returns appropriate error message

**`lib/csp-middleware.test.ts`**

- [x] Sets correct CSP headers
- [x] Blocks inline scripts in CSP
- [x] Allows trusted CDNs

**`lib/security/ai-safety-guard.test.ts`**

- [x] Detects role override injection attempts (7 patterns)
- [x] Detects jailbreak attempts (8 patterns)
- [x] Detects prompt extraction attempts (7 patterns)
- [x] Detects delimiter injection attempts (6 patterns)
- [x] Allows legitimate requests without false positives (7 test cases)
- [x] Detects off-topic requests per agent domain
- [x] Allows on-topic requests for defined agents
- [x] Sanitizes Google/Gemini model references (5 patterns)
- [x] Sanitizes competitor AI references (GPT, Claude, Anthropic)
- [x] Detects and blocks harmful output content
- [x] Logs security events with proper truncation
- [x] AI-based safety check with mock mode and fallback
- [x] Handles case variations and obfuscation attempts
- [x] Generates embedded safety instructions for prompts
- [x] Full input/output guard pipeline integration

#### Integration Tests

**`infra/cloud-run.integration.test.ts`**

- [ ] Cloud Run service responds to health check
- [ ] Can connect to Cloud SQL
- [ ] Can read from Secret Manager
- [ ] Can write to GCS bucket

---

## Phase 1: Identity & Organization Management (AuthN & AuthZ)

**Goal:** Implement robust authentication, multi-tenant orgs, and Cedar-based authorization.

**Prerequisites:** Phase 0 complete. OAuth secrets configured. DB deployed.

### 1.1 Database Schema (Cloud SQL PostgreSQL)

- [ ] **Define Prisma Schema (or raw SQL migrations):**

  ```prisma
  model User {
    id            String   @id @default(uuid())
    email         String   @unique
    name          String?
    authProvider  String   // "google", "apple", "msa", "saml", "oidc"
    authProviderId String?
    createdAt     DateTime @default(now())
    memberships   Membership[]
    sessions      Session[]
  }

  model Org {
    id              String   @id @default(uuid())
    name            String
    type            String   // "team" | "enterprise"
    domain          String?  @unique // For enterprise
    domainVerified  Boolean  @default(false)
    verificationToken String?
    ssoConfig       Json?    // SAML metadata or OIDC config
    stripeCustomerId String?
    plan            String   @default("free")
    tokensRemaining Int      @default(1000)
    quotaResetDate  DateTime?
    createdAt       DateTime @default(now())
    memberships     Membership[]
    invites         Invite[]
    contextFiles    ContextFile[]
  }

  model Membership {
    id      String @id @default(uuid())
    userId  String
    orgId   String
    role    String // "owner", "admin", "member", "auditor", "billing_manager"
    user    User   @relation(fields: [userId], references: [id])
    org     Org    @relation(fields: [orgId], references: [id])
    @@unique([userId, orgId])
  }

  model Invite {
    id          String   @id @default(uuid())
    orgId       String
    email       String
    role        String
    token       String   @unique
    status      String   @default("pending") // "pending", "accepted", "expired"
    invitedBy   String
    createdAt   DateTime @default(now())
    expiresAt   DateTime
    org         Org      @relation(fields: [orgId], references: [id])
  }

  model Session {
    id        String   @id @default(uuid())
    userId    String
    agentId   String
    orgId     String?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    archived  Boolean  @default(false)
    summaryUrl String?
    user      User     @relation(fields: [userId], references: [id])
    messages  Message[]
  }

  model Message {
    id        String   @id @default(uuid())
    sessionId String
    role      String   // "user" | "agent"
    content   String   // Markdown for display
    jsonData  Json?    // Structured JSON (for agent responses)
    tokensUsed Int?
    createdAt DateTime @default(now())
    session   Session  @relation(fields: [sessionId], references: [id])
  }

  model ContextFile {
    id        String   @id @default(uuid())
    orgId     String
    name      String
    gcsPath   String
    mimeType  String
    sizeBytes Int
    agentIds  String[] // Empty = all agents
    createdAt DateTime @default(now())
    org       Org      @relation(fields: [orgId], references: [id])
  }
  ```

- [x] **Prisma Schema:** Created `prisma/schema.prisma` with all models (User, Org, Membership, Invite, Session, Message, File, ContextFile, Agent, UsageRecord, StripeEvent).
- [x] **Prisma Client:** Created `lib/db/client.ts` singleton with HMR support.
- [ ] **Run Migrations:** `npx prisma migrate dev` in dev. Integrate migration into CI/CD for beta/prod.

### 1.2 Social OAuth Login (Google, Apple, Microsoft Entra ID)

> **Implementation Status:** Google OAuth is **LIVE** in dev. Apple and Microsoft are placeholders.

- [x] **NextAuth.js v5 Setup:** Configure providers in `auth.ts`. Providers are conditionally loaded based on env vars.
  - [x] **Google OAuth:** Live on `ai-dev.oz.ly`. Secrets stored in Secret Manager.
  - [ ] **Apple Sign-In:** Placeholder. Requires Apple Developer Program ($99/yr) and domain verification.
  - [ ] **Microsoft Entra ID:** Placeholder. Uses issuer URL pattern with tenant ID.
- [x] **Callbacks:**
  - `jwt`: Attach `userId` and `provider` to token.
  - `session`: Expose `userId` and `email` to client.
- [x] **Login UI:** `SocialAuthButtons` component shows available providers. Buttons auto-hide when provider not configured.
- [x] **Route Handler:** `/api/auth/[...nextauth]/route.ts` exports NextAuth handlers.
- [x] **Secret Manager Integration:** `cloudbuild.yaml` injects `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` into Cloud Run.
- [x] **Test:** Integration tests in `lib/__tests__/auth.integration.test.ts` covering user creation (all 3 providers), session tracking, provider restrictions (12 tests).

### 1.3 Enterprise SSO (BYO SAML/OIDC)

- [ ] **SSO Config API:** `POST /api/org/:orgId/sso` for admins to upload SAML metadata (XML) or OIDC config (issuer, clientId, clientSecret). Store in `Org.ssoConfig`.
- [ ] **Dynamic Provider Routing:**
  - On login page, user enters email.
  - Backend checks if email domain matches an enterprise org with verified domain and SSO config.
  - If yes, redirect to enterprise IdP (SAML AuthnRequest or OIDC authorize URL).
  - Handle callback at `/api/auth/callback/saml/:orgId` or `/api/auth/callback/oidc/:orgId`.
- [ ] **SAML Integration:** Use `passport-saml` or `saml2-js`. Validate signature, extract NameID/email, create/link user.
- [ ] **OIDC Integration:** Use `openid-client`. Validate ID token, extract claims.
- [ ] **Test:** Use Okta or Azure AD test tenant to verify SAML and OIDC flows.

### 1.4 Team Org Creation & Invites

> **Implementation Status:** API routes + UI integration **COMPLETE**. Email sending deferred.

- [x] **Create Team API:** `POST /api/org` with `{ name, slug?, type: "TEAM" }`. Creator becomes `OWNER`. Validates identity from Google, Apple, or Microsoft only.
- [x] **List Orgs API:** `GET /api/org` returns user's organizations with roles.
- [x] **Members API:** `GET /api/org/:orgId/members` returns all org members with user details in org page.
- [x] **Invite API:** `POST /api/org/:orgId/invite` with `{ email, role }`. Generates secure token, stores Invite record, sets 7-day expiry. Owner/Admin only (Cedar + direct check).
- [x] **List Invites API:** `GET /api/org/:orgId/invite` returns pending invites with expiry status.
- [x] **Revoke Invite API:** `DELETE /api/org/:orgId/invite?inviteId=...` marks invite as revoked.
- [x] **Accept Invite API:** `POST /api/invite/accept` with `{ token }`. Validates token, email match, provider. Creates Membership in transaction.
- [x] **Get Invite Info:** `GET /api/invite/accept?token=...` returns public invite details (no auth required).
- [ ] **Send Invite Email:** Deferred to email service integration (SendGrid/SES).
- [x] **Invite UI:** Organization page integrates MembersTab with real API data (`app/(app)/organization/`).
  - InviteForm: Role-based visibility (owner/admin only)
  - TeamMembersList: Shows all members with role management
  - PendingInvitesList: Shows pending invites with revoke functionality
- [x] **Invite Acceptance Page:** `/invite/accept` page with token validation, email matching, and accept/decline flows.
  - Suspense boundary for SSR compatibility
  - Shows invite details, organization info
  - Email mismatch warning
  - 11 tests for acceptance page
- [x] **Unit Tests:** 68 tests covering org creation, listing, members API, invite CRUD, UI components, and invite acceptance.
- [x] **Integration Tests:** `lib/__tests__/org.integration.test.ts` covers invite creation, acceptance, revocation with database (8+ tests).
- [ ] **E2E Tests:** Playwright tests for invite UI flow.

### 1.5 Enterprise Domain Verification

- [x] **Verification Token Generation:** On GET request, generate random token if not exists, store in `Org.verificationToken`.
- [x] **Verification API:** `POST /api/org/:orgId/verify-domain` performs DNS TXT lookup for `_expertai-verify.{domain}`. If matches token, sets `domainVerified = true`.
  - GET endpoint returns verification status, instructions, and token
  - POST endpoint performs DNS lookup and verifies token match
  - Handles multi-part TXT records
  - Returns already verified status without DNS lookup
  - 21 tests covering GET/POST, authorization, DNS lookup, error handling, security
- [x] **UI:** Instructions provided via GET response (recordType, recordName, recordValue, example)
- [x] **Test:** Mock DNS lookup in tests; tests cover ENOTFOUND, mismatch, and success cases

### 1.6 Cedar Policy Engine Integration

> **Implementation Status:** Cedar engine is **COMPLETE** with in-memory TypeScript implementation. 86 tests passing.

- [x] **Cedar Setup:** Implemented high-performance in-memory Cedar engine in `lib/authz/cedar.ts`. Uses TypeScript-native policy evaluation instead of WASM for faster startup in serverless.
- [x] **CedarActions Registry:** Type-safe action enumeration with explicit ID assignments (prevents accidental breaking changes).
- [x] **Define Policies:** 11 comprehensive policies implemented:
  - `admin-full-access`: System admins bypass all checks
  - `global-view-public-agents`: Anyone can view public agent catalog
  - `user-query-own-sessions`: Users can query their own sessions
  - `anonymous-limited-access`: Anonymous users can only view landing pages
  - `owner-manage-org`: Org owners have full control
  - `admin-manage-org`: Org admins can manage except billing
  - `auditor-view-logs`: Auditors can view usage and session logs
  - `member-use-agents`: Members can query agents and view team context
  - `billing-manager`: Billing managers handle subscription only
  - `user-manage-sessions`: Users can CRUD their own sessions
  - `user-manage-files`: Users can CRUD their own files
- [x] **Authorization Middleware:** `withAuthZ(action, getResource)` wrapper in `lib/authz/middleware.ts`. Integrates with NextAuth v5 via `auth()`.
  1. Get authenticated user from `auth()` session.
  2. Build Cedar principal with roles, memberships.
  3. Call `cedar.isAuthorized(principal, action, resource)`.
  4. Return 401/403 on failure with reason.
- [x] **AuthZ Coverage Enforcement:** `scripts/check-authz-coverage.ts` enforces 100% API route coverage. Runs in pre-commit and CI.
- [x] **Test:** 30 policy tests + 9 middleware tests passing. Full coverage of permit/deny scenarios.

### 1.7 Workspace Switcher

- [x] **API:** `GET /api/org` returns user's orgs with roles (implemented as part of 1.4).
- [x] **UI Component:** Dropdown in header showing current context (Personal or Org name). Allow switching. (`components/layouts/workspace-switcher.tsx`)
- [x] **Context Propagation:** `lib/context/workspace-context.tsx` - Cookie-based storage, React context provider, role checks. 22 tests.

### 1.8 Phase 1 Test Requirements

> **Status:** Unit tests for Org and Invite APIs are COMPLETE. **221 total tests passing**. Integration and E2E test infrastructure configured.

#### Unit Tests (Vitest)

**`app/api/org/__tests__/org.test.ts`** - 13 tests ✅

- [x] Creates team with owner membership
- [x] Rejects non-Google/Apple/Microsoft users
- [x] Validates org name length and format
- [x] Returns 401 for unauthenticated
- [x] Returns 409 if slug already exists
- [x] Returns 400 if user owns too many orgs
- [x] Accepts Apple provider
- [x] Accepts Microsoft (Entra ID) provider
- [x] Lists user organizations with roles
- [x] Returns empty array for user with no orgs

**`app/api/org/__tests__/invite.test.ts`** - 21 tests ✅

- [x] Creates invite when user is org owner/admin
- [x] Generates secure random token
- [x] Sets 7-day expiry
- [x] Rejects duplicate pending invites (409)
- [x] Only owner/admin can invite (403 for members)
- [x] Returns 404 when org doesn't exist
- [x] Returns 409 when user already a member
- [x] Returns 400 for invalid email format
- [x] Lists pending invites for org owner
- [x] Revokes invite successfully
- [x] Creates membership on valid token
- [x] Rejects expired token (410)
- [x] Rejects already-accepted token (409)
- [x] Rejects email mismatch (403)
- [x] Handles case where user already member
- [x] Returns invite info for valid token (no auth)
- [x] Returns 403 for non-trusted provider

**`lib/authz/cedar.test.ts`** - 30 tests ✅

- [x] Owner can manage org (invite, billing, settings)
- [x] Admin can manage org except billing
- [x] Member cannot invite
- [x] User cannot access other org's resources
- [x] Anonymous users have limited access
- [x] Default deny for unknown actions (`denies unknown actions` test)
- [x] Anonymous user has no permissions (covered by Anonymous Principal tests)

**`lib/authz/middleware.test.ts`** - 9 tests ✅

- [x] Returns 403 when Cedar denies (`returns 403 when Cedar denies access`)
- [x] Proceeds when Cedar permits (`executes handler when Cedar permits access`)
- [x] Constructs principal correctly from session (`passes route params to getResource`)
- [x] Returns 401 for unauthenticated users

#### Integration Tests (Vitest + Test DB)

**`lib/__tests__/auth.integration.test.ts`** ✅

- [x] Creates user with Google provider
- [x] Creates user with Apple provider
- [x] Creates user with Microsoft Entra ID provider
- [x] Enforces unique email constraint
- [x] Finds user by email
- [x] Loads user with membership relation
- [x] Returns correct role for each org

**`lib/__tests__/org.integration.test.ts`** ✅

- [x] Creates org with owner membership in single transaction
- [x] Enforces unique slug constraint
- [x] Creates invite with correct expiry
- [x] Invite acceptance creates membership
- [x] Prevents duplicate pending invites
- [x] Revokes invite correctly
- [x] User can belong to multiple orgs
- [x] Org data is properly isolated
- [x] Cross-org access denied

#### E2E Tests (Playwright) ✅

**`e2e/auth-flow.spec.ts`** ✅

- [x] Protected page redirects to login
- [x] Login page renders correctly
- [x] Can access dashboard after login (with test principal)
- [x] User menu shows user info
- [x] Session persists across navigations

**`e2e/team-invite.spec.ts`** ✅

- [x] Owner can see invite button
- [x] Invite form validates email
- [x] Pending invites are listed
- [x] Member cannot see invite button
- [x] Invite acceptance page shows org info
- [x] Accept button calls API correctly

**`e2e/workspace-switch.spec.ts`** ✅

- [x] Workspace switcher shows current context
- [x] Dropdown shows all available workspaces
- [x] Can switch to different workspace
- [x] Personal workspace always available
- [x] Keyboard accessible

**`e2e/enterprise-sso.spec.ts`** (Deferred to Phase 1.3)

- [ ] Email domain routes to SSO
- [ ] SAML login completes
- [ ] User associated with enterprise

---

## Phase 2: Core Application – Agent Catalog & Schema System

**Goal:** Implement the agent catalog, Zod-based input/output schemas, and prompt templating system.

**Prerequisites:** Phase 1 complete. User can log in and has org context.

### 2.1 Agent Catalog Data Model

- [x] **Agent Catalog Table:** Prisma model exists in schema.prisma (Agent model)
- [x] **In-Memory Registry:** `lib/agents/ux-analyst/index.ts` exports agent config
- [x] **Agent API:** `GET /api/agents` lists agents with Cedar filtering. `GET /api/agents/[agentId]` returns schema.
- [x] **Seed Agents:** UX Analyst (public), Legal Advisor (beta), Finance Planner (beta) defined in API.

### 2.2 Zod Input/Output Schemas ✅

- [x] **Create Schema Package:** `lib/agents/` (using lib instead of packages for Next.js compatibility)
- [x] **Define Input Schema:** `lib/agents/ux-analyst/input-schema.ts` - File upload, product context, analysis options
- [x] **Define Output Schema:** `lib/agents/ux-analyst/output-schema.ts` - Findings, recommendations, scores, accessibility
- [x] **JSON Schema Export:** `lib/schemas/zod-to-json-schema.ts` - A2A protocol compatible schema export:
  - `zodSchemaToJsonSchema()` - Convert Zod to JSON Schema 7
  - `generateAgentCard()` - Generate A2A Agent Cards with input/output schemas
  - `exportAgentCatalogManifest()` - Export full agent catalog as JSON
  - Schema introspection: `extractFieldDescriptions()`, `getRequiredFields()`, `isA2ACompatible()`
  - Basic validation: `validateAgainstSchema()`
  - 33 tests covering export, agent cards, validation, introspection
- [x] **Define Input Schema per Agent (Legal Advisor):** `lib/agents/legal-advisor/input-schema.ts`:
  - 12 jurisdictions (US, UK, EU, CA, AU, SG + US/EU state variants)
  - 12 contract types (employment, NDA, service agreement, license, etc.)
  - File upload with supporting documents (max 10)
  - Review priority, deal value, analysis options
  - Form configuration for dynamic UI generation

- [x] **Define Output Schema per Agent (Legal Advisor):** `lib/agents/legal-advisor/output-schema.ts`:
  - Contract metadata extraction (parties, dates, governing law)
  - Risk assessment with score (0-100) and category breakdown
  - Findings with severity, category, clause references, risk explanation
  - Recommendations with priority, suggested language, negotiation tips
  - Clause summaries with favorability and market comparison
  - Compliance checks, negotiation strategy, key dates
  - Confidence score and legal disclaimers
- [x] **Create Prompt Template (Legal Advisor):** `lib/agents/legal-advisor/prompt-template.ts`:
  - Handlebars template with jurisdiction and contract type labels
  - JSON output schema instructions for structured responses
  - Conditional sections for supporting docs, concerns, org context
- [x] **Create Markdown Renderer (Legal Advisor):** `lib/agents/legal-advisor/renderer.ts`:
  - Risk score visualization with color-coded bars
  - Findings grouped by severity with badges
  - Recommendations by priority with suggested language
  - Clause analysis table with favorability indicators
  - Compliance status and negotiation strategy sections
- [x] **Legal Advisor Tests:** 43 tests covering input/output schemas, prompt compilation, rendering

- [x] **Define Input Schema per Agent (Finance Planner):** `lib/agents/finance-planner/input-schema.ts`:
  - 11 service types (budget, investment, retirement, tax optimization, etc.)
  - 6 client types (individual, family, business, startup, enterprise, nonprofit)
  - Financial inputs (income, expenses, assets, liabilities, savings rate)
  - File upload for financial statements (PDF, Excel, CSV)
  - Analysis preferences (projections, tax, risk)
  - Form configuration for dynamic UI generation

- [x] **Define Output Schema per Agent (Finance Planner):** `lib/agents/finance-planner/output-schema.ts`:
  - Financial health assessment with score (0-100)
  - Budget analysis with expense breakdown
  - Investment recommendations with allocation percentages
  - Action plan with priority, impact, and timeline
  - Financial projections (conservative/moderate/optimistic scenarios)
  - Tax optimization suggestions
  - Risk assessment with mitigation strategies
  - Goal analysis with feasibility and milestones

- [x] **Create Prompt Template (Finance Planner):** `lib/agents/finance-planner/prompt-template.ts`:
  - Handlebars template with currency formatting
  - Service-type conditional sections
  - Comprehensive JSON output schema
  - Financial disclaimers embedded

- [x] **Create Markdown Renderer (Finance Planner):** `lib/agents/finance-planner/renderer.ts`:
  - Health score visualization
  - Budget breakdown tables
  - Investment allocation charts
  - Action items grouped by priority
  - Multi-scenario projections
  - Tax and risk sections

- [x] **Finance Planner Tests:** 49 tests covering input/output schemas, prompt compilation, rendering

### 2.3 Prompt Templates (Handlebars)

- [ ] **Create Template per Agent:**

  ```handlebars
  {{! packages/agents/legal-advisor/prompt.hbs }}
  You are a legal expert AI specializing in
  {{jurisdiction}}
  contract law. Your task is to analyze contracts and provide actionable legal
  insights. IMPORTANT: You MUST respond with a valid JSON object matching this
  schema: { "executiveSummary": "string", "findings": [{"title": "string",
  "severity": "critical|high|medium|low", "description": "string",
  "clauseReference": "string (optional)"}], "recommendations": [{"action":
  "string", "priority": "immediate|short-term|long-term", "rationale":
  "string"}], "appendix": "string (optional)" } Do NOT include any text outside
  the JSON object. ## Contract to Analyze - **Type:**
  {{contractType}}
  - **Jurisdiction:**
  {{jurisdiction}}
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

  Please analyze the contract and provide your findings.
  ```

### 2.4 Markdown Renderers ✅

- [x] **UX Analyst Renderer:** `lib/agents/ux-analyst/renderer.ts` - Full Markdown rendering with:
  - Scores dashboard with visual bars
  - Findings grouped by severity
  - Recommendations with effort/impact tables
  - Accessibility compliance section
  - Competitor analysis (optional)
  - 12 renderer tests

### 2.5 Agent Catalog API ✅

- [x] **List Agents:** `GET /api/agents` returns agents visible to current user (Cedar filtering by `isBeta` and `allowedOrgIds`).
- [x] **Get Agent:** `GET /api/agents/[agentId]` returns agent config + JSON Schema from Zod (for dynamic form rendering).
- [x] **Agent API Tests:** 8 tests covering anonymous/authenticated access, security (no internal paths exposed).
- [x] **Agent Landing Pages:** SSG pages at `/agents/[agentId]` with:
  - Hero section with agent name, tagline, description, and CTAs
  - Features grid with checkmarks
  - Capabilities section with icons
  - Use cases with examples
  - FAQ section
  - Final CTA with tier requirements
  - SEO metadata and OpenGraph tags for all agents
  - Not-found handler for invalid agents
  - 23 unit tests covering SSG, metadata, rendering
- [ ] **A/B Testing for Landing Pages:** Implement variant selection (randomized or via query param). Track conversion metrics (CTA clicks, signups) per variant.
- [ ] **Localization Support:** Agent catalog supports `localeVariants` field mapping locale → context file overrides (e.g., "Tax Advisor" → US/UK/Japan regulatory docs).

### 2.6 OmniAgent Orchestrator (Single Entry Point)

> **Per DESIGN.md:** Users who don't know which expert to choose can use "OmniAgent" – a dispatcher that routes queries to the most appropriate agent.

- [x] **Classifier Prompt:** Keyword-based classification with confidence scoring (AI-based classification planned for future).
- [x] **Fallback Handling:** Returns noMatchSuggestion: "We don't have an expert for that topic yet." when no match found.
- [x] **Confirmation UX:** OmniConfirmDialog component (`components/agents/omni-confirm-dialog.tsx`):
  - Shows suggested agent with confidence badge (green ≥80%, amber 50-79%, red <50%)
  - Displays reasoning and alternatives for ambiguous queries
  - Low confidence warning with suggestion to review alternatives
  - No-match state with helpful suggestions
  - Keyboard accessible with proper ARIA roles
  - 19 tests covering all states and interactions
- [x] **OmniAgent API:** `POST /api/omni/route` with `{ query }` returns `{ suggestedAgentId, agentName, confidence, reasoning, alternatives? }`.
  - GET endpoint returns list of available agents with domains
  - 28 tests covering classification accuracy, input validation, alternatives, security
- [x] **UI Integration:** OmniAgentSelector component updated (`components/agents/omni-agent-selector.tsx`):
  - "Ask OmniAI" as first dropdown option
  - Optional search input for query classification
  - Live classification with confidence badge
  - Grouped agents by category
  - Beta badges for beta agents
  - `showConfirmDialog` prop to enable confirmation flow
  - 15 tests covering rendering, props, search, integration, and dialog

### 2.7 Multi-Agent Chaining (A2A Protocol) ✅

> **Per DESIGN.md:** Structured output from Agent A can directly feed Agent B if schemas are compatible.

- [x] **Define Mapper Functions:** `lib/agents/chaining/mapper-registry.ts`
  - ux-to-legal: UX findings → Legal compliance review
  - ux-to-finance: UX recommendations → Budget/ROI analysis
  - legal-to-finance: Legal findings → Risk assessment
  - finance-to-legal: Financial projections → Regulatory review
  - 29 mapper tests covering all transformations
- [x] **Chain API:** `POST /api/agents/:agentId/chain`
  - GET endpoint returns chainable targets
  - POST executes multi-agent pipeline
  - Step-by-step results with token tracking
  - Cedar authorization on chain execution
  - 11 API tests
- [x] **Types:** `lib/agents/chaining/types.ts`
  - ChainExecutionRequest/Result schemas
  - MapperRegistry interface
  - ChainValidationResult for error handling

### 2.8 Guided Interview Mode

> **Per DESIGN.md:** Agents with `guidedInterview: true` enter interactive Q&A to gather context before main analysis.

- [x] **Schema Flag:** Add `supportsGuidedInterview: boolean` to agent config (exists in UX Analyst, Legal Advisor, Finance Planner).
- [x] **Interview Steps Config:** Define interview flow in agent config (question sequence, types, validation, conditional branches).
- [x] **Interview API:** `POST /api/agents/:agentId/interview` manages multi-turn context gathering:
  - Creates/resumes sessions with sessionId
  - Returns `{ sessionId, currentStep, totalSteps, progress, isComplete, currentQuestion, answers, canStartAnalysis, nextAction }`
  - GET endpoint returns interview config and step metadata
  - Question types: text, textarea, select, multiselect, file, boolean
  - Answer validation: required, minLength, maxLength
  - Skip optional questions with `skipQuestion: true`
  - 22 tests covering session management, validation, progress, security
- [x] **State Machine:** Backend tracks interview state per session. Completes when all required context gathered.
- [x] **UI Integration:** GuidedInterviewPanel component (`components/interview/guided-interview-panel.tsx`):
  - One question at a time with progress indicator
  - Progress bar and step counter (Step X of Y)
  - Question input types: text, textarea, select, boolean
  - Skip button for optional questions
  - "Start Now" button when canStartAnalysis is true
  - "Start Analysis" button when interview complete
  - Loading, error, and complete states
  - 18 tests covering rendering, navigation, input types, completion

### 2.9 Vertex AI Search Integration (Massive RAG)

> **Per DESIGN.md:** For customers with large pre-loading contexts (legal codes, medical journals, technical manuals), use Vertex AI Search.

- [ ] **Allow-listed Feature:** Enterprise tier only. Enable via feature flag per org.
- [ ] **Index Configuration:** Create Vertex AI Search datastore per org for massive knowledge bases.
- [ ] **Ingestion Pipeline:** Cloud Function triggered on large context file upload → indexes into Vertex AI Search.
- [ ] **Query Integration:** Agent prompt includes retriever tool to fetch relevant chunks from Vertex AI Search index.
- [ ] **Size Threshold:** Auto-route to Vertex AI Search when org context exceeds 100MB or 500 files.

### 2.6 Phase 2 Test Requirements

#### Unit Tests (Vitest/Jest)

**`schemas/legal-advisor-input.test.ts`** ✅ (in `legal-advisor.test.ts`)

- [x] Accepts valid input with all required fields
- [x] Rejects missing `jurisdiction`
- [x] Rejects invalid enum value
- [x] Accepts optional `supportingDocuments`
- [x] Validates file structure for `primaryContract`

**`schemas/legal-advisor-output.test.ts`** ✅ (in `legal-advisor.test.ts`)

- [x] Parses valid agent JSON response
- [x] Rejects missing `executiveSummary`
- [x] Rejects invalid severity enum
- [x] Accepts empty `findings` array
- [x] Validates nested recommendation structure

**`schemas/zod-to-json-schema.test.ts`** ✅

- [x] Exports valid JSON Schema from Zod
- [x] Preserves `.describe()` as descriptions
- [x] Handles enum types correctly
- [x] Handles array types correctly

**`agents/prompt-template.test.ts`** ✅ (in agent-specific test files)

- [x] Compiles Handlebars template without errors
- [x] Interpolates simple fields correctly
- [x] Handles `{{#each}}` for file arrays
- [x] Handles `{{#if}}` conditionals
- [x] Escapes special characters safely

**`agents/renderer.test.ts`** ✅ (in agent-specific test files)

- [x] Renders all sections for complete output
- [x] Handles empty findings gracefully
- [x] Includes clause references when present
- [x] Formats severity correctly (uppercase)
- [x] Omits appendix when null

**`api/agents-list.test.ts`** ✅ (in `agents.test.ts`)

- [x] Returns all public agents
- [x] Filters beta agents for non-beta users
- [x] Includes beta agents for allowed orgs
- [x] Returns 200 for unauthenticated (public agents only)

**`api/agents-get.test.ts`** ✅

- [x] Returns full config for valid agentId
- [x] Returns 404 for unknown agentId
- [x] Returns 403 for unauthorized beta agent

#### Integration Tests

**`api/agents.integration.test.ts`** _(Covered by unit tests in `agents.test.ts`)_

> Note: These scenarios are tested via mocked unit tests which provide equivalent coverage.

- [x] Seeded agents appear in list (tested via mock in `agents.test.ts`)
- [x] Agent config includes input schema JSON (tested in `returns agent metadata fields`)
- [x] Beta agent hidden from regular user (tested in `does not return beta agents`)
- [x] Beta agent visible to allowed org (tested in `returns agents with membership check`)

#### E2E Tests (Playwright)

**`e2e/agent-catalog.spec.ts`** ✅

- [x] Sidebar shows agent list
- [x] Clicking agent navigates to chat UI
- [x] Beta badge visible on beta agents
- [x] Agent landing page renders correctly

**`e2e/dynamic-form.spec.ts`** ✅

- [x] Form renders from schema
- [x] Dropdown shows enum options
- [x] File upload field accepts files
- [x] Validation errors display on submit

#### Additional Tests for New Features

**`api/omni-agent.test.ts`** _(OmniAgent Orchestrator)_ ✅ (in `app/api/omni/route/__tests__/route.test.ts` - 28 tests)

- [x] Classifies legal question to legal-advisor agent
- [x] Classifies ambiguous query and returns multiple alternatives
- [x] Returns "no suitable agent" for unsupported domain
- [x] Logs feature suggestions when fallback triggered

**`api/agent-chaining.test.ts`** _(Multi-Agent Chaining)_ _(Vertex AI mocked)_

- [ ] Executes 2-agent chain successfully
- [ ] Validates output at each step
- [ ] Fails chain if intermediate validation fails
- [ ] Returns combined result with source attribution

**`api/guided-interview.test.ts`** _(Guided Interview Mode)_ ✅ (in `app/api/agents/[agentId]/interview/__tests__/route.test.ts` - 22 tests)

- [x] Returns first question on interview start
- [x] Advances to next question on valid answer
- [x] Completes interview when all required context gathered
- [x] Persists interview state per session

**`e2e/omni-agent.spec.ts`** _(AI response mocked)_ ✅

- [x] "Ask OmniAI" appears first in agent selector
- [x] User types query → appropriate agent suggested
- [x] User confirms → redirected to agent chat

**`e2e/guided-interview.spec.ts`** _(AI response mocked)_ ✅

- [x] Interview mode shows one question at a time
- [x] Progress indicator updates
- [x] "Start Analysis" enabled when complete

---

## Phase 3: Core Application – Query Flow & File Handling

**Goal:** Implement the end-to-end query flow: file uploads, prompt assembly, Vertex AI call, response validation, storage.

**Prerequisites:** Phase 2 complete. Agent schemas and templates defined.

### 3.1 File Upload (Signed URLs) ✅

- [x] **Request Upload URL:** `POST /api/upload` with `{ filename, mimeType, sizeBytes }`. Validates size limits (10MB query, 50MB context). Generates GCS signed URL. Returns `{ uploadUrl, gcsPath, fileId, expiresAt }`.
  - Implemented in `app/api/upload/route.ts`
  - 26 tests covering auth, MIME types, size limits, security (path traversal, XSS)
- [x] **MIME Type Validation:** Allows PDF, Word, Excel, images, text files. Rejects executables, scripts, HTML.
- [x] **Size Limits by Purpose:** query=10MB, context=50MB, avatar=1MB
- [x] **Security:** Filename sanitization prevents path traversal and XSS. User ID isolation in GCS paths.
- [x] **Frontend Upload with Progress:** `lib/hooks/use-file-upload.ts` hook + `FileUploadProgress` component:
  - XMLHttpRequest for progress tracking during GCS upload
  - Concurrent upload support (up to 3 files)
  - Abort/cancel support
  - Retry failed uploads
  - FileUploadProgress component shows per-file progress, previews, status icons
  - 32 tests covering hook state management and component rendering
- [x] **Confirm Upload:** Optional `autoConfirm` option in hook calls `POST /api/upload/confirm`
- [ ] **Virus Scanning:** Cloud Function on GCS finalize (future enhancement).

### 3.2 Org Context Files ✅

- [x] **Upload Context:** `POST /api/org/:orgId/context` (admin only)
  - Implemented in `app/api/org/[orgId]/context/route.ts`
  - Validates MIME types (PDF, Word, Excel, text, markdown, CSV, JSON)
  - Size limit: 50MB per file
  - Count limit: 20 files per org
  - Returns signed upload URL for GCS
  - Supports optional `agentIds` filter for agent-specific context
  - 21 tests covering auth, authorization, validation, limits
- [x] **List Context:** `GET /api/org/:orgId/context`
  - Returns files with metadata (name, type, size, agentIds)
  - Shows remaining slots vs limit
  - All org members can view
- [x] **Delete Context:** `DELETE /api/org/:orgId/context/:fileId`
  - Admin-only deletion
  - Removes from GCS and database
  - Cross-org deletion prevention
  - 8 tests covering auth, authorization, security
- [x] **UI:** Admin page section for context file management
  - Implemented in `app/(app)/organization/context-files-tab.tsx`
  - New "Context Files" tab in organization settings
  - Upload with progress tracking
  - File list with type icons, size, date, agent filters
  - Delete with confirmation
  - Admin-only upload/delete controls
  - 10 tests for ContextFilesTab component

### 3.3 Query Orchestration API ✅

- [x] **Endpoint:** `POST /api/query` - Full implementation in `app/api/query/route.ts`
  - 15 tests covering auth, validation, quota, successful queries, security
- [x] **Implementation Flow:**
  1. ✅ **Authenticate:** Get user from session via Auth.js
  2. ✅ **Authorize:** Cedar check for `QueryAgent` action
  3. ✅ **Load Agent Config:** Registry with schemas, templates, renderers
  4. ✅ **Validate Input:** Zod schema validation with detailed errors
  5. ✅ **Check Quota:** Token quota from org or free tier fallback
  6. ✅ **Process Files:** Generate signed read URLs for uploaded files
  7. ✅ **Load Org Context:** Fetch relevant ContextFiles for active org
  8. ✅ **Compile Prompt:** Handlebars template compilation
     ```typescript
     const context = {
       ...validatedInputs,
       primaryContract: { filename: "...", url: signedUrl },
       supportingDocuments: [...],
       orgContext: orgContextText,
     };
     const prompt = Handlebars.compile(template)(context);
     ```
  9. ✅ **Call Vertex AI:** `lib/vertex/client.ts` - Gemini 3 Pro with structured JSON output
  10. ✅ **Validate Output:** Zod schema validation of AI response
  11. ✅ **Render Markdown:** Agent-specific renderer function
  12. ✅ **Store Message:** Session and Message records created
  13. ✅ **Deduct Tokens:** Updates org `tokensRemaining`
  14. ✅ **Return Response:** `{ sessionId, output, markdown, usage, metadata }`

- [x] **Integrate AI Safety Guard (DESIGN.md §Multi-Tenancy and Security):** ✅ Implemented in `app/api/query/route.ts`
  - [x] **Step 5a - Input Safety Check:** After Zod validation, call `guardInput()` from `lib/security/ai-safety-guard.ts`:

    ```typescript
    import {
      guardInput,
      guardOutput,
      getEmbeddedSafetyInstructions,
    } from "@/lib/security";

    const inputGuard = await guardInput(userQuery, {
      userId: session.user.id,
      agentId: agent.id,
      useAICheck: false, // Enable for deep analysis
    });
    if (!inputGuard.allowed) {
      return NextResponse.json(
        { error: inputGuard.userMessage },
        { status: 400 },
      );
    }
    ```

  - [x] **Step 9a - Embed Safety Instructions:** Prepend `getEmbeddedSafetyInstructions()` to compiled prompt:
    ```typescript
    const safetyInstructions = getEmbeddedSafetyInstructions();
    const fullPrompt = safetyInstructions + "\n\n" + prompt;
    ```
  - [x] **Step 12a - Output Safety Check:** After AI response, call `guardOutput()`:
    ```typescript
    const outputGuard = await guardOutput(rawOutput, {
      userId: session.user.id,
      agentId: agent.id,
    });
    // Use outputGuard.output (sanitized) instead of rawOutput
    ```
  - [x] **Log Security Events:** Security events are auto-logged to console (Cloud Logging ready)

- [x] **Integrate PII Detection (DESIGN.md §Compliance Guardrails):** ✅ Implemented in `app/api/query/route.ts`
  - [x] **Step 5b - Input PII Check:** After Safety Guard, call `guardInputForPII()`:
    ```typescript
    const piiGuard = await guardInputForPII(JSON.stringify(validatedInputs), {
      userId: session.user.id,
      agentId,
    });
    if (!piiGuard.allowed) {
      return NextResponse.json(
        {
          error: "Privacy Protection",
          piiTypesDetected: piiGuard.result?.summary,
        },
        { status: 400 },
      );
    }
    ```
  - [x] **Step 12b - Output PII Check:** After AI response, check and redact PII:
    ```typescript
    const outputPIIGuard = await guardOutputForPII(
      JSON.stringify(validatedOutput),
      { userId, agentId },
    );
    const finalOutput = outputPIIGuard.result?.redactedContent
      ? JSON.parse(outputPIIGuard.result.redactedContent)
      : validatedOutput;
    ```
  - [x] **PII Integration Tests:** 4 tests in `query.test.ts` covering SSN, credit card, combined PII, and legitimate requests

### 3.4 Vertex AI Client ✅ (NEW)

- [x] **Client Implementation:** `lib/vertex/client.ts`
  - Gemini 3 Pro (`gemini-3-pro-preview`) on global endpoint
  - Structured JSON output mode
  - Token estimation and usage tracking
  - Safety filter configuration
  - Mock mode for testing (`VERTEX_AI_MOCK=true`)
  - 12 tests covering mock mode, token estimation, safety checks

### 3.5 Session Management

- [x] **Create Session:** On first query with no `sessionId`, creates new Session record
- [x] **Continue Session:** On subsequent queries, loads session, appends messages
- [x] **List Sessions:** `GET /api/sessions` returns user's sessions (with agent name, last message preview, timestamp).
- [x] **Get Session:** `GET /api/sessions/:sessionId` returns full message history.
- [x] **Delete Session:** `DELETE /api/sessions/:sessionId` soft-deletes (archives) session.

### 3.5 Memory Summarization

- [ ] **Scheduled Job:** Cloud Scheduler triggers `POST /api/internal/summarize` daily.
- [ ] **Summarization Logic:**
  1. Find sessions with `updatedAt` > 14 days ago and `archived = false`.
  2. For each, call Gemini 3 Flash with summarization prompt.
  3. Save summary to GCS, update `Session.summaryUrl`, set `archived = true`.
  4. Optionally delete old messages to save space.
- [ ] **Resume Archived Session:** On query to archived session, load summary into prompt context first.

### 3.6 Phase 3 Test Requirements

> **⚠️ MOCKING REQUIREMENT:** All integration and E2E tests MUST mock Vertex AI/Gemini API calls. Use fixture responses to avoid API costs. Only run live AI tests in dedicated "golden path" test suite with budget controls.

#### Unit Tests (Vitest/Jest)

**`upload/signed-url.test.ts`**

- [ ] Generates valid GCS signed URL
- [ ] Rejects file > size limit (10MB)
- [ ] Rejects disallowed MIME types
- [ ] Returns unique `gcsPath` per request
- [ ] Returns 401 for unauthenticated

**`upload/confirm.test.ts`**

- [ ] Creates ContextFile record on confirm
- [ ] Associates with correct `orgId`
- [ ] Handles missing file in GCS gracefully

**`query/input-validation.test.ts`**

- [ ] Parses valid input per schema
- [ ] Returns 400 with validation errors
- [ ] Handles File field references correctly

**`query/quota-check.test.ts`**

- [ ] Returns 402 when tokens exhausted
- [ ] Proceeds when tokens available
- [ ] Handles org-level quota correctly

**`query/prompt-assembly.test.ts`**

- [ ] Loads correct template for agent
- [ ] Interpolates all input fields
- [ ] Includes file URLs in prompt
- [ ] Includes org context when present
- [ ] Handles missing optional fields

**`query/vertex-call.test.ts`** _(uses mocked Vertex client)_

- [ ] Constructs correct API payload
- [ ] Includes JSON output mode config
- [ ] Handles Vertex API timeout
- [ ] Handles Vertex API error response
- [ ] Parses token usage from metadata

**`query/output-validation.test.ts`**

- [ ] Parses valid JSON from LLM
- [ ] Logs error on invalid JSON
- [ ] Returns graceful failure message
- [ ] Validates against output schema

**`query/token-deduction.test.ts`**

- [ ] Deducts exact tokens used
- [ ] Updates user balance atomically
- [ ] Updates org balance when in org context
- [ ] Handles race conditions (transactions)

**`session/create.test.ts`**

- [ ] Creates session with correct agentId
- [ ] Associates with user and org
- [ ] Returns valid sessionId

**`session/continue.test.ts`**

- [ ] Loads existing session
- [ ] Appends new message
- [ ] Updates `updatedAt` timestamp
- [ ] Returns 404 for invalid sessionId

**`summarization/job.test.ts`** _(uses mocked Gemini Flash)_

- [ ] Finds stale sessions correctly
- [ ] Generates summary via LLM (mocked)
- [ ] Saves summary to GCS
- [ ] Marks session as archived

#### Integration Tests (Supertest + Test DB + **Mocked Vertex AI**)

**`api/upload.integration.test.ts`**

- [ ] Full upload flow: request URL → PUT file → confirm
- [ ] File appears in GCS (mocked)
- [ ] ContextFile record created in DB

**`api/query.integration.test.ts`** _(Vertex AI mocked with fixture response)_

- [ ] Full query flow: input → prompt → Vertex (mocked) → response
- [ ] Message stored in DB
- [ ] Tokens deducted correctly
- [ ] New session created when no sessionId
- [ ] Session continued when sessionId provided

**`api/query-errors.integration.test.ts`** _(Vertex AI mocked)_

- [ ] 400 on invalid input
- [ ] 402 on quota exhausted
- [ ] 403 on unauthorized agent access
- [ ] 500 on Vertex API failure (graceful)

**`api/sessions.integration.test.ts`**

- [ ] List returns user's sessions
- [ ] Get returns full message history
- [ ] Cross-user session access denied

**`api/org-context.integration.test.ts`**

- [ ] Admin can upload context file
- [ ] Member cannot upload (403)
- [ ] Context included in query prompt

#### E2E Tests (Playwright + **Mocked AI Backend**)

**`e2e/file-upload.spec.ts`**

- [ ] User uploads PDF via drag-drop
- [ ] Progress indicator shows
- [ ] File appears in attachments list
- [ ] Error shown for oversized file

**`e2e/query-flow.spec.ts`** _(AI response mocked via MSW or API stub)_

- [ ] User fills form and submits
- [ ] Loading indicator during query
- [ ] Agent response displays in Markdown
- [ ] Session created and visible in history

**`e2e/follow-up-query.spec.ts`** _(AI response mocked)_

- [ ] User asks follow-up question
- [ ] Session continues with context
- [ ] Multiple exchanges in one session

**`e2e/quota-exhausted.spec.ts`**

- [ ] Error modal on quota exhausted
- [ ] Upgrade button links to billing

---

## Phase 4: Frontend – Main Application UI

**Goal:** Build the main chat/document UI with dynamic forms, Markdown rendering, and interactive features.

**Prerequisites:** Phase 3 complete. APIs functional.

### 4.1 Agent Selection Sidebar

- [x] **Component:** Sidebar listing agents (from `GET /api/agents`). Group by category if many. Show beta badge. Highlight selected agent.
- [ ] **Workspace Indicator:** Show current org context at top of sidebar.

### 4.2 Dynamic Input Form

- [x] **Schema-Driven Form:** Use `react-hook-form` + `@hookform/resolvers/zod` + custom field renderer.
- [x] **Field Types:**
  - `z.string()` → Text input
  - `z.enum([...])` → Select dropdown
  - `z.boolean()` → Checkbox
  - `z.any()` with file description → Single file upload
  - File arrays → Multi-file upload
- [x] **Descriptions:** Use `.describe()` metadata for labels and hints.
- [ ] **Submit Handler:** Validate, upload files, call `POST /api/query`.

### 4.3 Chat/Document Display

- [x] **Markdown Renderer:** Use `react-markdown` with `remark-gfm`. Sanitize via `rehype-sanitize`.
- [x] **Message List:** Show conversation history (user questions, agent responses).
- [x] **Loading State:** Show typing indicator / spinner while awaiting response.
- [ ] **Streaming (Optional):** If backend supports SSE, stream response incrementally.

### 4.4 Highlight & Comment (Inline Follow-up)

- [x] **Text Selection:** On mouseup in agent response, detect selection.
- [x] **Tooltip:** Show "Ask about this" button near selection.
- [x] **Follow-up Input:** Open popover with text area. Pre-fill with quoted text.
- [x] **Submit:** Send as new query with context: `"Regarding: '{selectedText}'\n\nUser asks: {followUpQuestion}"`.
- [ ] **Display:** Show follow-up Q&A in threaded view or inline.

### 4.5 Session History & Revision

- [x] **Session Selector:** Dropdown or sidebar list of past sessions.
- [ ] **Revision History:** If session has multiple agent responses, show version selector or timeline.
- [ ] **Diff View (Stretch):** Highlight changes between versions.

### 4.6 Chat Panel (Separate from Report)

> **Per DESIGN.md:** Two-panel UX: Document panel (main) for structured output + Chat panel (side) for unstructured Q&A.

- [x] **Collapsible Chat Sidebar:** Right-side panel for free-form follow-up questions.
- [x] **Chat vs Report Separation:** Chat is for clarifying discussion; Report is the polished structured output.
- [x] **"Incorporate into Report" Button:** User can request agent to produce new report version incorporating chat discussion.
- [x] **Chat History:** Persist chat separately from report revisions. Show user questions + agent replies in conversational format.
- [ ] **Sync State:** When chat updates report, mark in chat "✓ Incorporated into v3".

### 4.7 Export & Share

- [x] **Export PDF:** Button triggers `renderToMarkdown` → `md-to-pdf` or Puppeteer server-side. Return download link.
- [x] **Export DOCX:** Optional Word export for enterprise users.
- [x] **Share Link:** `POST /api/share` creates shared artifact with UUID. Return link. Recipient can view (login required for MVP).
- [x] **Share to Team/Org:** Option to share with entire team/org (changes artifact ACL).
- [x] **Artifact Favorites/Pinning:** Users can pin/favorite artifacts for quick access. Show in "Favorites" section.
- [ ] **Artifact List View:** `GET /api/artifacts` returns user's artifacts. Filter by: favorites, recent, shared-with-me.

### 4.7 Phase 4 Test Requirements

#### Unit Tests (Vitest/Jest + React Testing Library)

**`components/agent-sidebar.test.tsx`**

- [x] Renders agent list from API
- [x] Shows beta badge when `isBeta: true`
- [x] Highlights selected agent
- [x] Calls `onSelectAgent` when agent clicked
- [ ] Shows workspace indicator

**`components/forms/dynamic-form.test.tsx`**

- [x] Renders text input for `z.string()`
- [x] Renders dropdown for `z.enum()`
- [x] Renders file upload for file descriptions
- [x] Shows validation errors on submit
- [x] Calls `onSubmit` with validated data

**`components/file-upload.test.tsx`** (integrated into dynamic-form)

- [x] Accepts drag-drop files
- [ ] Shows progress during upload
- [ ] Displays error for oversized file
- [x] Shows filename after upload

**`components/chat/markdown-display.test.tsx`**

- [x] Renders Markdown correctly
- [x] Sanitizes XSS attempts
- [x] Renders code blocks with language labels
- [x] Renders tables and lists

**`components/chat/message-list.test.tsx`**

- [x] Renders user and agent messages
- [x] Shows loading indicator during query
- [x] Auto-scrolls to bottom on new message

**`components/chat/highlight-comment.test.tsx`**

- [x] Shows tooltip on text selection
- [x] Opens popover on click
- [x] Pre-fills selected text
- [x] Calls `onSubmit` with follow-up

**`components/sessions/session-history.test.tsx`**

- [x] Renders session list from API
- [x] Shows agent name and timestamp
- [x] Calls `onSelectSession` when clicked
- [x] Shows loading and error states
- [x] Supports search filtering
- [x] Handles pagination

**`components/artifacts/export-share.test.tsx`**

- [x] Export button triggers API call
- [x] Share button opens modal
- [x] Copy link button works
- [x] Favorite toggle button works
- [x] Link revoke functionality

**`hooks/useAgents.test.ts`**

- [ ] Fetches agents from API
- [ ] Returns loading state
- [ ] Returns error on failure
- [ ] Caches with TanStack Query

**`hooks/useQuery.test.ts`**

- [ ] Sends query to API
- [ ] Returns loading/success/error states
- [ ] Invalidates cache on success

#### E2E Tests (Playwright + **Mocked AI Backend**)

**`e2e/chat-ui.spec.ts`** _(AI response mocked)_

- [ ] Agent sidebar displays
- [ ] Selecting agent shows input form
- [ ] Submitting query shows response
- [ ] Response renders as Markdown

**`e2e/highlight-follow-up.spec.ts`** _(AI response mocked)_

- [ ] User selects text in response
- [ ] Tooltip appears near selection
- [ ] Clicking opens comment popover
- [ ] Submitting sends follow-up query
- [ ] Follow-up response displays

**`e2e/session-history.spec.ts`**

- [ ] Past sessions appear in sidebar
- [ ] Clicking session loads history
- [ ] New query in old session continues

**`e2e/export-pdf.spec.ts`**

- [ ] Export button triggers download
- [ ] Downloaded file is valid PDF

**`e2e/share-link.spec.ts`**

- [ ] Share creates link
- [ ] Opening link shows content
- [ ] Unauthenticated redirects to login

**`e2e/responsive-mobile.spec.ts`**

- [ ] Sidebar collapses on mobile
- [ ] Input form usable on mobile
- [ ] Response readable on mobile

#### Additional Tests for New Phase 4 Features

**`components/chat-panel.test.tsx`** _(Chat Panel)_

- [ ] Renders collapsible sidebar
- [ ] Shows chat history
- [ ] "Incorporate into Report" button visible
- [ ] Sync state indicator shows after incorporation

**`components/artifact-list.test.tsx`** _(Artifact Favorites)_

- [ ] Renders list of artifacts
- [ ] Shows favorite icon for pinned items
- [ ] Clicking favorite toggles pin state
- [ ] Filters by: favorites, recent, shared

**`e2e/chat-panel.spec.ts`** _(AI response mocked)_

- [ ] Chat sidebar opens from report view
- [ ] User can ask follow-up in chat
- [ ] "Incorporate" button updates report
- [ ] Chat shows "✓ Incorporated into v3"

**`e2e/artifact-favorites.spec.ts`**

- [ ] User can pin an artifact
- [ ] Pinned artifacts appear in Favorites section
- [ ] User can unpin artifact
- [ ] Shared-with-me shows artifacts shared by others

---

## Phase 5: Billing & Subscription Enforcement

**Goal:** Integrate Stripe for subscriptions, enforce token quotas.

**Prerequisites:** Phases 1-4 complete. Core functionality working.

### 5.1 Stripe Checkout Integration

- [x] **Checkout API:** `POST /api/billing/checkout` with `{ priceId, orgId? }` creates Stripe Checkout Session. Returns `sessionId` and `url`.
  - Creates/retrieves Stripe customer for user or org
  - Validates priceId in production against known prices
  - Org billing requires ADMIN/OWNER membership
  - Sets metadata with userId and orgId for webhook processing
  - 17 tests covering session creation, price validation, URLs, auth, org billing, metadata, errors
- [ ] **Frontend:** Redirect to Stripe Checkout using `stripe.redirectToCheckout({ sessionId })`.
- [ ] **Success/Cancel URLs:** Redirect back to app with status.

### 5.2 Stripe Webhooks

- [x] **Endpoint:** `POST /api/stripe/webhook` with signature verification.
  - Verifies signature via stripe.webhooks.constructEvent
  - Idempotency via StripeEvent table (prevents duplicate processing)
  - 9 tests covering signature, idempotency, events, storage
- [x] **Handle Events:**
  - `checkout.session.completed`: Updates org with Stripe customer ID, plan, and token quota
  - `invoice.payment_succeeded`: Resets token quota on renewal
  - `invoice.payment_failed`: Logs payment failure (TODO: email notification)
  - `customer.subscription.deleted`: Downgrades to free plan
- [ ] **Token Top-Up:** Handle one-time purchases to add tokens.

### 5.3 Quota Enforcement ✅

- [x] **Quota Service:** `lib/billing/quota-service.ts`
  - `checkQuota()`: Pre-query check with org context, returns upgrade prompts
  - `deductTokens()`: Atomic token deduction
  - `getUsageSummary()`: UI usage data
  - `resetQuota()`: Reset on billing renewal
  - 21 unit tests covering all functions
- [x] **Query Integration:** `app/api/query/route.ts` uses quota service
  - Pre-query check returns 402 with upgrade prompt if exhausted
  - Post-query deduction with actual token count
- [x] **Usage API:** `GET /api/billing/usage`
  - Returns usage summary for authenticated user
  - Supports org and personal context
- [x] **UI Indicator:** `components/billing/usage-indicator.tsx`
  - Compact header view with progress bar
  - Detailed account page view
  - Low-usage warnings (<10% remaining)
  - Upgrade prompts when exhausted
  - 8 component tests

### 5.4 Customer Portal

- [x] **Portal API:** `POST /api/billing/portal` creates Stripe Customer Portal session. Returns URL.
  - Requires ADMIN, OWNER, or BILLING_MANAGER role
  - Validates org has Stripe customer ID
  - 13 tests covering session creation, auth, authorization, errors
- [ ] **UI:** "Manage Subscription" button opens portal in new tab.

### 5.5 Phase 5 Test Requirements

#### Unit Tests (Vitest/Jest)

**`billing/checkout.test.ts`** ✅ (in `app/api/billing/checkout/__tests__/route.test.ts` - 17 tests)

- [x] Creates Stripe Checkout session
- [x] Links to correct priceId
- [x] Sets success/cancel URLs
- [x] Returns 401 for unauthenticated

**`billing/webhook.test.ts`** ✅ (in `app/api/stripe/webhook/__tests__/route.test.ts` - 9 tests)

- [x] Returns 400 if stripe-signature missing
- [x] Returns 400 for invalid signature
- [x] Skips already processed events (idempotency)
- [x] Updates org with Stripe customer and plan on checkout completed
- [x] Sets token quota based on plan
- [x] Resets token quota on invoice payment succeeded
- [x] Downgrades org to free on subscription deleted
- [x] Stores event for idempotency tracking
- [x] Marks event as processed after handling
- [ ] Logs failure event
- [ ] Does not deduct tokens

**`billing/webhook-cancel.test.ts`**

- [ ] Downgrades to free tier
- [ ] Preserves remaining tokens until period end

**`billing/token-topup.test.ts`**

- [ ] Adds tokens on one-time purchase
- [ ] Does not reset quota date

**`billing/quota-check.test.ts`**

- [ ] Returns true when tokens > 0
- [ ] Returns false when tokens = 0
- [ ] Checks org balance when in org context

**`billing/portal.test.ts`**

- [ ] Creates portal session
- [ ] Returns portal URL
- [ ] Requires authenticated user

#### Integration Tests (Supertest + Stripe Test Mode)

**`api/billing.integration.test.ts`**

- [ ] Checkout flow creates subscription (test mode)
- [ ] Webhook updates DB on payment
- [ ] Token balance updated correctly

**`api/quota.integration.test.ts`** _(Vertex AI mocked)_

- [ ] Query succeeds when tokens available
- [ ] Query returns 402 when exhausted
- [ ] Balance decreases after query

**`api/portal.integration.test.ts`**

- [ ] Portal session created successfully
- [ ] Returns valid Stripe URL

#### E2E Tests (Playwright)

**`e2e/subscription-flow.spec.ts`** _(Stripe test mode)_

- [ ] User clicks upgrade button
- [ ] Redirects to Stripe Checkout
- [ ] After payment, plan updated in UI

**`e2e/quota-ui.spec.ts`**

- [ ] Usage bar shows current/total
- [ ] Warning appears when low
- [ ] Upgrade prompt on exhausted

**`e2e/billing-portal.spec.ts`** _(Stripe test mode)_

- [ ] Manage button opens Stripe portal
- [ ] User can update payment (test mode)

---

## Phase 6: Advanced UX Features

**Goal:** Polish the experience with admin interfaces, browser extension, and collaboration features.

**Prerequisites:** Phases 1-5 complete.

### 6.1 Admin Interfaces

- [ ] **Org Member Management:** List members, change roles, remove members.
- [ ] **Org Context Files:** Upload, list, delete context files.
- [ ] **Billing Dashboard:** Show plan, usage, manage subscription button.
- [ ] **Enterprise SSO Config:** Domain verification status, SSO upload.
- [ ] **Usage Analytics:** Per-user and per-agent token consumption.

### 6.2 Audit Logging (Enterprise)

- [ ] **Log Events:** Login, file upload, query, admin actions, policy flags.
- [ ] **Storage:** Dedicated `AuditLog` table or export to Cloud Logging.
- [ ] **API:** `GET /api/org/:orgId/audit-logs` (admin only, Cedar-protected).
- [ ] **UI:** Searchable table of events with filters.

### 6.3 Browser Extension (MVP)

- [ ] **Manifest V3:** Create Chrome extension with `permissions` for API domain.
- [ ] **Popup UI:** Agent selector dropdown, text input, submit button.
- [ ] **Context Menu:** Right-click "Ask about this" sends selected text.
- [ ] **Auth:** Use existing session cookie (same domain) or implement extension OAuth flow.
- [ ] **Display:** Show quick answer in popup, "View full" opens web app.

### 6.4 Guided Interview Mode (Stretch)

- [ ] **Multi-Turn Context Gathering:** For agents with `supportsGuidedInterview: true`, enter interactive Q&A to gather context before main analysis.
- [ ] **State Machine:** Define interview steps in agent config. UI shows current question, collects answer, progresses.

---

## Phase 7: Testing, Security, & Launch

**Goal:** Ensure quality, security, and production readiness.

### 7.1 Testing

- [ ] **Unit Tests:** ≥80% coverage on critical paths (auth, billing, schema validation).
- [ ] **Integration Tests:** API endpoint tests against dev environment.
- [ ] **E2E Tests (Playwright):** Full user flows: signup → query → export.
- [ ] **Load Testing:** Simulate concurrent users in Gamma. Verify Cloud Run scales.

### 7.2 Security Hardening

- [x] **Auth Review:** All protected routes check session. No exposed secrets.
  - lib/**tests**/security-audit.test.ts: 21 security tests
  - All routes use auth() from NextAuth.js v5
  - Secrets stored in Secret Manager, never in code
- [x] **AuthZ Review:** Cedar denies cross-tenant access. Test with malicious inputs.
  - 100% API route coverage via pnpm test:authz-coverage
  - Cross-tenant isolation tested in cedar.test.ts and context-delete.test.ts
  - Default-deny policy architecture
- [x] **Input Validation:** All inputs validated via Zod. No SQL/NoSQL injection.
  - All POST routes use z.object().safeParse()
  - Prisma ORM prevents SQL injection
  - File upload validates MIME types and size
- [x] **XSS Prevention:** Markdown sanitized. CSP headers configured.
  - CSP middleware in lib/security/csp-middleware.ts (18 tests)
  - React-markdown with restricted allowedElements
- [x] **Dependency Audit:** `pnpm audit` fixed all vulnerabilities (2026-01-16)
  - Upgraded Next.js: 15.0.0 → 15.5.9 (fixed 7 vulnerabilities)
  - CVE-2024-XXXXX: Authorization Bypass in Middleware (Critical) ✅
  - CVE-2024-XXXXX: RCE in React Flight Protocol (Critical) ✅
  - CVE-2024-XXXXX: DoS with Server Components (High) ✅
  - CVE-2024-XXXXX: Cache Poisoning (Low) ✅
  - Current status: **No known vulnerabilities**

### 7.3 Production Deployment

- [ ] **Final Pulumi Apply:** Ensure prod infra matches latest config.
- [ ] **Smoke Test:** Verify core flows in prod with test account.
- [ ] **DNS Cutover:** Point production domain to Cloud Run.
- [ ] **Monitoring:** Verify logs, traces, alerts flowing.
- [ ] **On-Call:** Establish responsibility for incident response.

### 7.4 Launch

- [ ] **Beta Users:** Invite initial users, gather feedback.
- [ ] **Feature Flags:** Gradually enable agents/features.
- [ ] **Documentation:** Update user-facing help docs.
- [ ] **Retrospective:** Capture lessons learned for future phases.

---

## Appendix: Key Technical References

| Topic                  | Reference                                         |
| ---------------------- | ------------------------------------------------- |
| Zod Documentation      | https://zod.dev                                   |
| Handlebars             | https://handlebarsjs.com                          |
| Cedar Policy Language  | https://www.cedarpolicy.com                       |
| Vertex AI Agent Engine | https://cloud.google.com/vertex-ai/docs/agents    |
| Gemini 3               | Model: `gemini-3-pro-preview`, Location: `global` |
| TanStack Query         | https://tanstack.com/query                        |
| Stripe Webhooks        | https://stripe.com/docs/webhooks                  |
| OpenTelemetry          | https://opentelemetry.io                          |
| Pulumi GCP Provider    | https://www.pulumi.com/registry/packages/gcp      |
