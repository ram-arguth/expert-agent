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

### Pre-Commit Hooks (Husky)

Pre-commit hooks run the same checks as CI/CD to catch issues early:

- [ ] **Configure Husky:** Install `husky` and `lint-staged` for pre-commit hooks
- [ ] **Pre-commit checks (must pass before commit):**
  - [ ] `pnpm lint` – ESLint with strict rules
  - [ ] `pnpm typecheck` – TypeScript compilation check
  - [ ] `pnpm test:unit` – Run unit tests (fast, <30s target)
  - [ ] `pnpm test:authz-coverage` – Verify all API routes have Cedar calls
  - [ ] `pnpm test:component-usage` – Check shared component usage
- [ ] **Pre-push checks:**
  - [ ] `pnpm test:integration` – Run integration tests (mocked external services)

### AI/LLM Mocking Policy

> **⚠️ MANDATORY:** All tests (unit, integration, E2E) MUST mock Vertex AI/Gemini API calls to avoid costs.

- [ ] **Create mock fixtures:** Define realistic agent response fixtures in `__fixtures__/agents/`
- [ ] **Mock implementation:** Use `vitest.mock()` or `msw` to intercept Vertex AI client
- [ ] **Golden path suite (optional):** Separate test suite (`test:golden`) for live AI calls with budget controls, run manually or weekly in CI

### Authorization Coverage Check

> **⚠️ MANDATORY:** Every API route MUST call Cedar for authorization. Routes without Cedar calls are flagged as failures.

- [ ] **Create `scripts/check-authz-coverage.ts`:**
  ```typescript
  // Scans all files in app/api/**/*.ts
  // Checks each route handler (GET, POST, PUT, DELETE) calls withAuthZ() or cedar.isAuthorized()
  // Outputs: ✅ route has authz, ❌ route missing authz
  // Exit code 1 if any route is missing authz
  ```
- [ ] **Exceptions list:** Maintain `authz-exceptions.json` for intentionally public routes (e.g., healthcheck, webhook with signature verification)
- [ ] **CI integration:** Run as part of `pnpm test:authz-coverage` in pre-commit and CI

**`scripts/check-authz-coverage.test.ts`**

- [ ] Detects route without Cedar call
- [ ] Passes route with `withAuthZ()` wrapper
- [ ] Passes route with explicit `cedar.isAuthorized()`
- [ ] Respects exceptions list
- [ ] Fails CI if any uncovered route found

### Shared Component Usage Check

> **⚠️ RECOMMENDED:** UI components should use shared Radix UI primitives from `packages/ui`. Direct HTML elements for common patterns are flagged.

- [ ] **Create `scripts/check-component-usage.ts`:**
  ```typescript
  // Scans all files in apps/web/components/**/*.tsx
  // Flags direct usage of: <button>, <input>, <select>, <dialog>, <dropdown>
  // Suggests: use <Button>, <Input>, <Select>, <Dialog>, <DropdownMenu> from @expert-ai/ui
  // Warning (not blocking): components using raw HTML for primitives
  ```
- [ ] **Shared component library:** All primitives in `packages/ui/src/primitives/`
- [ ] **CI integration:** Run as part of `pnpm test:component-usage` in pre-commit (warning-only, not blocking)

**`scripts/check-component-usage.test.ts`**

- [ ] Flags `<button>` usage in component file
- [ ] Passes `<Button>` from shared library
- [ ] Flags `<input type="text">` without shared wrapper
- [ ] Reports count of violations per file

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

**Prerequisites:** GCP organization with billing; domain name; GitHub repo access; Stripe/Apple Developer/Google Cloud accounts.

### 0.1 Repository & Tooling Setup

- [ ] **Initialize Monorepo:** Create repository with structure:
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
  └── .github/workflows/    # CI/CD
  ```
- [ ] **Branch Strategy:** `main` (squash-merged only), `dev` (active development). Tags: `beta-*`, `gamma-*`, `prod-*` for promotions.
- [ ] **Tooling:** Configure ESLint, Prettier, Husky pre-commit hooks. Add `turbo` or `nx` for monorepo task orchestration.
- [ ] **Dependencies:** Install core packages:
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

### 0.3 CI/CD Pipeline (GitHub Actions or Cloud Build)

- [ ] **On Push to `dev`:**
  1. Install dependencies (pnpm cache)
  2. Run lint, type-check, unit tests
  3. Build Next.js app
  4. Build Docker image, push to Artifact Registry
  5. Deploy to `expert-ai-dev` Cloud Run
  6. Run smoke test (healthcheck endpoint)
- [ ] **On Tag `beta-*`:**
  1. Deploy tagged image to `expert-ai-beta`
  2. Run E2E tests (Playwright against beta)
  3. Notify team (Slack/email)
- [ ] **On Tag `gamma-*`:**
  1. Deploy tagged image to `expert-ai-gamma`
  2. Run E2E tests (Playwright against gamma)
  3. Notify team (Slack/email)
- [ ] **On Tag `prod-*`:**
  1. Require manual approval
  2. Deploy to `expert-ai-prod`
  3. Run smoke test
  4. Notify team
- [ ] **Pulumi Integration:** Run `pulumi preview` on PR, `pulumi up` on merge to `main` (with approval for prod stack).

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

- [ ] **OAuth Clients:**
  - Google: Create OAuth 2.0 Client ID in Cloud Console. Set redirect URI. Store in Secret Manager.
  - Apple: Create Service ID, generate private key, verify domain (upload `.well-known/apple-developer-domain-association.txt`). Store in Secret Manager.
  - Microsoft (MSA): Register app in Azure AD. Store in Secret Manager.
- [ ] **Stripe:** Create account, define Products/Prices for plans (Free, Pro, Enterprise). Get API keys (test + live). Configure webhook endpoint (`/api/stripe/webhook`).
- [ ] **Email Service (Optional):** Set up SendGrid/Mailgun for transactional emails (invites, notifications). Configure SPF/DKIM DNS records.

### 0.5 Observability Foundation

- [ ] **Structured Logging:** Configure Winston or Pino for JSON logs. Include `traceId`, `spanId`, `userId`, `orgId` in log context.
- [ ] **OpenTelemetry Setup:** Initialize OTEL SDK in Next.js API routes. Configure:
  - W3C TraceContext propagator (for frontend→backend trace correlation)
  - Cloud Trace exporter
  - Sampling: 100% in dev/beta, 1% in prod (always sample errors)
- [ ] **Metrics:** Define key metrics (request latency, tokens used, error count). Emit to Cloud Monitoring.
- [ ] **Alerting:** Create Cloud Monitoring alert policies (error rate spike, high latency, quota exhaustion).

### 0.6 Security & Cost Protection Infrastructure

> **Per DESIGN.md:** Critical security and cost guardrails must be established at infrastructure level.

- [ ] **CMEK (Customer-Managed Encryption Keys):** For enterprise orgs requiring it, configure Cloud KMS key rings and enable CMEK for GCS buckets.
- [ ] **VPC Service Controls:** Configure VPC-SC perimeter around Vertex AI Agent Engine to restrict network access to authorized sources only.
- [ ] **Content Filtering & Safety:** Enable Vertex AI content moderation for agent outputs. Configure safety filters for user inputs (strip malicious patterns).
- [ ] **Compliance Guardrails:** Implement configurable PII detection layer that can flag sensitive data in inputs/outputs based on org policy.
- [ ] **Circuit Breaker for Cost:** Implement anomalous usage detection:
  - Threshold: >$100 spend in 1 hour by single user → auto-suspend account + alert admin
  - Per-org daily budget caps with automatic cutoff
  - Real-time cost tracking dashboard for admins
- [ ] **Rate Limiting:** Configure per-user and per-org rate limits (e.g., 100 requests/hour free tier, 1000/hour pro).
- [ ] **CSP Headers:** Configure strict Content-Security-Policy to mitigate XSS. Disallow inline scripts, allow only trusted CDNs.
- [ ] **Input Size Limits:** Enforce file size limits (default 10MB, configurable per plan). Large files route to async processing.

### 0.7 Phase 0 Test Requirements

#### Unit Tests (Vitest/Jest)

**`lib/rate-limiter.test.ts`**

- [ ] Allows requests under limit
- [ ] Blocks requests over limit
- [ ] Resets after time window
- [ ] Applies correct limits per tier (free/pro)

**`lib/circuit-breaker.test.ts`**

- [ ] Detects spend over threshold
- [ ] Triggers alert when threshold exceeded
- [ ] Suspends account correctly
- [ ] Admin override works

**`lib/input-validator.test.ts`**

- [ ] Accepts files under size limit
- [ ] Rejects files over size limit
- [ ] Returns appropriate error message

**`lib/csp-middleware.test.ts`**

- [ ] Sets correct CSP headers
- [ ] Blocks inline scripts in CSP
- [ ] Allows trusted CDNs

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

- [ ] **Run Migrations:** `npx prisma migrate dev` in dev. Integrate migration into CI/CD for beta/prod.

### 1.2 Social OAuth Login (Google, Apple, MSA)

- [ ] **NextAuth.js Setup:** Configure providers for Google, Apple, Microsoft. Set `NEXTAUTH_URL` and secrets.
- [ ] **Callbacks:**
  - `signIn`: Create/update User record in DB. Store `authProvider` and `authProviderId`.
  - `jwt`: Attach `userId` to token.
  - `session`: Expose `userId` and `email` to client.
- [ ] **Login UI:** Build `/login` page with branded SSO buttons: "Sign in with Google", "Sign in with Apple", "Sign in with Microsoft".
- [ ] **Test:** Verify new user creation, existing user login, session persistence.

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

- [ ] **Create Team API:** `POST /api/org` with `{ name, type: "team" }`. Creator becomes `owner`. Require identity from Google, Apple, or MSA (reject otherwise).
- [ ] **Invite API:** `POST /api/org/:orgId/invite` with `{ email, role }`. Generate secure token, store Invite record, set 7-day expiry. **Restrict invites to Google/Apple/MSA identities** (validate email domain compatibility).
- [ ] **Send Invite Email:** Use email service to send invite link: `https://app/invite?token=...`.
- [ ] **Accept Invite:** `POST /api/invite/accept?token=...`. User must be authenticated. Validate token, check email matches, create Membership, mark invite accepted.
- [ ] **Invite UI:** Team admin page with "Invite Member" form, pending invites list, resend/cancel buttons.
- [ ] **Test:** Full invite flow with two test accounts.

### 1.5 Enterprise Domain Verification

- [ ] **Verification Token Generation:** On enterprise org creation, generate random token, store in `Org.verificationToken`.
- [ ] **Verification API:** `POST /api/org/:orgId/verify-domain`. Perform DNS TXT lookup for `_expertai-verify.{domain}`. If matches token, set `domainVerified = true`.
- [ ] **UI:** Show verification instructions (DNS TXT record), "Verify Now" button.
- [ ] **Test:** Use a test domain or mock DNS lookup in dev.

### 1.6 Cedar Policy Engine Integration

- [ ] **Cedar Setup:** Include `@cedar-policy/cedar-wasm` or similar. Load policies on server start.
- [ ] **Define Policies:** Create `.cedar` policy files:

  ```cedar
  // Only org members can query agents in their org context
  permit(
    principal is User,
    action == "QueryAgent",
    resource is Agent
  ) when {
    principal.orgId == context.activeOrgId || resource.isPublic == true
  };

  // Only owners/admins can invite
  permit(
    principal is User,
    action == "InviteMember",
    resource is Org
  ) when {
    principal.role in ["owner", "admin"] && principal.orgId == resource.id
  };

  // Default deny
  forbid(principal, action, resource);
  ```

- [ ] **Authorization Middleware:** Create `withAuthZ(action, getResource)` wrapper for API routes. On each request:
  1. Get authenticated user from session.
  2. Load user's memberships/roles.
  3. Call `cedar.isAuthorized(principal, action, resource)`.
  4. Return 403 if denied.
- [ ] **Test:** Unit tests for policy logic. Integration tests for cross-org access denial.

### 1.7 Workspace Switcher

- [ ] **API:** `GET /api/user/memberships` returns user's orgs with roles.
- [ ] **UI Component:** Dropdown in header showing current context (Personal or Org name). Allow switching.
- [ ] **Context Propagation:** Store `activeOrgId` in session/cookie. Include in all API calls.

### 1.8 Phase 1 Test Requirements

#### Unit Tests (Vitest/Jest)

**`auth/oauth-callback.test.ts`**

- [ ] Creates new user on first Google login
- [ ] Updates existing user on repeat login
- [ ] Stores correct `authProvider` and `authProviderId`
- [ ] Rejects invalid OAuth state parameter
- [ ] Handles missing email claim gracefully

**`auth/session.test.ts`**

- [ ] Issues valid JWT with userId
- [ ] Rejects expired tokens
- [ ] Refreshes token correctly
- [ ] HttpOnly cookie is set with SameSite=Strict

**`org/create-team.test.ts`**

- [ ] Creates team with owner membership
- [ ] Rejects non-Google/Apple/MSA users
- [ ] Validates org name length and format
- [ ] Returns 401 for unauthenticated

**`org/invite.test.ts`**

- [ ] Generates secure random token
- [ ] Sets 7-day expiry
- [ ] Rejects duplicate pending invites
- [ ] Restricts to Google/Apple/MSA email domains
- [ ] Only owner/admin can invite (Cedar)

**`org/accept-invite.test.ts`**

- [ ] Creates membership on valid token
- [ ] Rejects expired token
- [ ] Rejects already-used token
- [ ] Rejects email mismatch
- [ ] Handles case where user already member

**`org/domain-verify.test.ts`**

- [ ] Returns true when DNS TXT matches
- [ ] Returns false when DNS TXT missing
- [ ] Handles DNS lookup timeout
- [ ] Sets `domainVerified = true` on success

**`authz/cedar-policies.test.ts`**

- [ ] Owner can invite members
- [ ] Admin can invite members
- [ ] Member cannot invite
- [ ] User cannot access other org's resources
- [ ] Default deny for unknown actions
- [ ] Anonymous user has no permissions

**`authz/middleware.test.ts`**

- [ ] Returns 403 when Cedar denies
- [ ] Proceeds when Cedar permits
- [ ] Constructs principal correctly from session
- [ ] Logs authorization decisions

#### Integration Tests (Supertest + Test DB)

**`api/auth.integration.test.ts`**

- [ ] Full OAuth flow with mocked IdP
- [ ] Session persists across requests
- [ ] Logout invalidates session

**`api/org.integration.test.ts`**

- [ ] Create team → invite → accept flow
- [ ] Enterprise domain verification flow
- [ ] SSO config upload and retrieval
- [ ] Cross-org access denied (403)

**`api/memberships.integration.test.ts`**

- [ ] User with multiple orgs returns all
- [ ] Switching activeOrgId changes context
- [ ] Role changes reflected immediately

#### E2E Tests (Playwright)

**`e2e/auth-flow.spec.ts`**

- [ ] New user signs up with Google
- [ ] Existing user logs in
- [ ] Logout clears session
- [ ] Protected page redirects to login

**`e2e/team-invite.spec.ts`**

- [ ] Owner invites member via UI
- [ ] Invitee receives email (mock)
- [ ] Invitee accepts and sees team
- [ ] Pending invite shows in admin UI

**`e2e/workspace-switch.spec.ts`**

- [ ] Dropdown shows all orgs
- [ ] Selecting org updates context
- [ ] Personal context available

**`e2e/enterprise-sso.spec.ts`**

- [ ] Email domain routes to SSO
- [ ] SAML login completes
- [ ] User associated with enterprise

---

## Phase 2: Core Application – Agent Catalog & Schema System

**Goal:** Implement the agent catalog, Zod-based input/output schemas, and prompt templating system.

**Prerequisites:** Phase 1 complete. User can log in and has org context.

### 2.1 Agent Catalog Data Model

- [ ] **Agent Catalog Table (or JSON config):**
  ```prisma
  model Agent {
    id              String   @id
    displayName     String
    description     String
    category        String?
    iconUrl         String?
    inputSchemaPath String   // Path to Zod input schema file
    outputSchemaPath String  // Path to Zod output schema file
    promptTemplatePath String // Path to Handlebars template
    rendererPath    String   // Path to Markdown renderer function
    isBeta          Boolean  @default(false)
    allowedOrgIds   String[] // Empty = public
    supportsGuidedInterview Boolean @default(false)
    createdAt       DateTime @default(now())
  }
  ```
- [ ] **Seed Agents:** Add initial agents (e.g., "Legal Advisor", "Finance Planner", "UX Analyst").

### 2.2 Zod Input/Output Schemas

- [ ] **Create Schema Package:** `packages/schemas/src/agents/`.
- [ ] **Define Input Schema per Agent:**

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

  export type LegalAdvisorInput = z.infer<typeof LegalAdvisorInputSchema>;
  ```

- [ ] **Define Output Schema per Agent:**

  ```typescript
  // packages/schemas/src/agents/legal-advisor/output.ts
  import { z } from "zod";

  export const LegalAdvisorOutputSchema = z.object({
    executiveSummary: z.string(),
    findings: z.array(
      z.object({
        title: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        description: z.string(),
        clauseReference: z.string().optional(),
      })
    ),
    recommendations: z.array(
      z.object({
        action: z.string(),
        priority: z.enum(["immediate", "short-term", "long-term"]),
        rationale: z.string(),
      })
    ),
    appendix: z.string().optional(),
  });

  export type LegalAdvisorOutput = z.infer<typeof LegalAdvisorOutputSchema>;
  ```

- [ ] **Export to JSON Schema:** Use `zod-to-json-schema` to generate A2A-compatible Agent Cards.

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

### 2.4 Markdown Renderers

- [ ] **Create Renderer per Agent:**

  ```typescript
  // packages/agents/legal-advisor/renderer.ts
  import { LegalAdvisorOutput } from "@expert-ai/schemas/agents/legal-advisor/output";

  export function renderToMarkdown(output: LegalAdvisorOutput): string {
    let md = `## Executive Summary\n\n${output.executiveSummary}\n\n`;
    md += `## Findings\n\n`;
    output.findings.forEach((f, i) => {
      md += `### ${i + 1}. ${f.title} (${f.severity.toUpperCase()})\n\n`;
      md += `${f.description}\n\n`;
      if (f.clauseReference) md += `*Reference: ${f.clauseReference}*\n\n`;
    });
    md += `## Recommendations\n\n`;
    output.recommendations.forEach((r, i) => {
      md += `${i + 1}. **${r.action}** (${r.priority})\n   ${r.rationale}\n\n`;
    });
    if (output.appendix) md += `## Appendix\n\n${output.appendix}\n`;
    return md;
  }
  ```

### 2.5 Agent Catalog API

- [ ] **List Agents:** `GET /api/agents` returns agents visible to current user (filter by `isBeta` and `allowedOrgIds` using Cedar).
- [ ] **Get Agent:** `GET /api/agents/:agentId` returns full agent config including input schema definition (for dynamic form rendering).
- [ ] **Agent Landing Pages:** Create SSG pages at `/agents/[agentId]` with description, example use cases, "Try Now" CTA.
- [ ] **A/B Testing for Landing Pages:** Implement variant selection (randomized or via query param). Track conversion metrics (CTA clicks, signups) per variant.
- [ ] **Localization Support:** Agent catalog supports `localeVariants` field mapping locale → context file overrides (e.g., "Tax Advisor" → US/UK/Japan regulatory docs).

### 2.6 OmniAgent Orchestrator (Single Entry Point)

> **Per DESIGN.md:** Users who don't know which expert to choose can use "OmniAgent" – a dispatcher that routes queries to the most appropriate agent.

- [ ] **Classifier Prompt:** Create a lightweight classifier (Gemini 3 Flash) that analyzes user query and returns best-fit `agentId`.
- [ ] **Fallback Handling:** If no suitable agent exists, respond with "We don't have an expert for that topic yet. Would you like to suggest we add one?" Log suggestion for roadmap.
- [ ] **Confirmation UX:** For ambiguous queries, ask user to confirm: "It looks like your question might be [domain]. Use the [Agent Name]?"
- [ ] **OmniAgent API:** `POST /api/omni/route` with `{ query }` returns `{ suggestedAgentId, confidence, alternatives? }`.
- [ ] **UI Integration:** Add "Ask OmniAI" as first option in agent selector. Route to appropriate agent after classification.

### 2.7 Multi-Agent Chaining (A2A Protocol)

> **Per DESIGN.md:** Structured output from Agent A can directly feed Agent B if schemas are compatible.

- [ ] **Define Mapper Functions:** For agents with compatible output→input schemas, create explicit mapper functions:
  ```typescript
  // lib/mappers/legal-to-risk.ts
  function mapLegalToRisk(legal: LegalAdvisorOutput): RiskAssessmentInput {
    return {
      findingsToAssess: legal.findings.map((f) => ({
        issue: f.title,
        severity: f.severity,
        context: f.description,
      })),
    };
  }
  ```
- [ ] **Chain API:** `POST /api/agents/:agentId/chain` orchestrates multi-agent pipeline. Validates output at each step.
- [ ] **Agent Catalog:** Add `chainable` flag and `compatibleOutputsTo: string[]` field for agents supporting chaining.

### 2.8 Guided Interview Mode

> **Per DESIGN.md:** Agents with `guidedInterview: true` enter interactive Q&A to gather context before main analysis.

- [ ] **Schema Flag:** Add `guidedInterview: boolean` to Input Template Schema.
- [ ] **Interview Steps Config:** Define interview flow in agent config (question sequence, conditional branches).
- [ ] **Interview API:** `POST /api/agents/:agentId/interview` manages multi-turn context gathering. Returns `{ currentQuestion, progress, isComplete }`.
- [ ] **State Machine:** Backend tracks interview state per session. Completes when all required context gathered.
- [ ] **UI Integration:** Interview mode shows one question at a time with progress indicator. "Start Analysis" button enabled when complete.

### 2.9 Vertex AI Search Integration (Massive RAG)

> **Per DESIGN.md:** For customers with large pre-loading contexts (legal codes, medical journals, technical manuals), use Vertex AI Search.

- [ ] **Allow-listed Feature:** Enterprise tier only. Enable via feature flag per org.
- [ ] **Index Configuration:** Create Vertex AI Search datastore per org for massive knowledge bases.
- [ ] **Ingestion Pipeline:** Cloud Function triggered on large context file upload → indexes into Vertex AI Search.
- [ ] **Query Integration:** Agent prompt includes retriever tool to fetch relevant chunks from Vertex AI Search index.
- [ ] **Size Threshold:** Auto-route to Vertex AI Search when org context exceeds 100MB or 500 files.

### 2.6 Phase 2 Test Requirements

#### Unit Tests (Vitest/Jest)

**`schemas/legal-advisor-input.test.ts`**

- [ ] Accepts valid input with all required fields
- [ ] Rejects missing `jurisdiction`
- [ ] Rejects invalid enum value
- [ ] Accepts optional `supportingDocuments`
- [ ] Validates File instance for `primaryContract`

**`schemas/legal-advisor-output.test.ts`**

- [ ] Parses valid agent JSON response
- [ ] Rejects missing `executiveSummary`
- [ ] Rejects invalid severity enum
- [ ] Accepts empty `findings` array
- [ ] Validates nested recommendation structure

**`schemas/zod-to-json-schema.test.ts`**

- [ ] Exports valid JSON Schema from Zod
- [ ] Preserves `.describe()` as descriptions
- [ ] Handles enum types correctly
- [ ] Handles array types correctly

**`agents/prompt-template.test.ts`**

- [ ] Compiles Handlebars template without errors
- [ ] Interpolates simple fields correctly
- [ ] Handles `{{#each}}` for file arrays
- [ ] Handles `{{#if}}` conditionals
- [ ] Escapes special characters safely

**`agents/renderer.test.ts`**

- [ ] Renders all sections for complete output
- [ ] Handles empty findings gracefully
- [ ] Includes clause references when present
- [ ] Formats severity correctly (uppercase)
- [ ] Omits appendix when null

**`api/agents-list.test.ts`**

- [ ] Returns all public agents
- [ ] Filters beta agents for non-beta users
- [ ] Includes beta agents for allowed orgs
- [ ] Returns 401 for unauthenticated

**`api/agents-get.test.ts`**

- [ ] Returns full config for valid agentId
- [ ] Returns 404 for unknown agentId
- [ ] Returns 403 for unauthorized beta agent

#### Integration Tests

**`api/agents.integration.test.ts`**

- [ ] Seeded agents appear in list
- [ ] Agent config includes input schema JSON
- [ ] Beta agent hidden from regular user
- [ ] Beta agent visible to allowed org

#### E2E Tests (Playwright)

**`e2e/agent-catalog.spec.ts`**

- [ ] Sidebar shows agent list
- [ ] Clicking agent navigates to chat UI
- [ ] Beta badge visible on beta agents
- [ ] Agent landing page renders correctly

**`e2e/dynamic-form.spec.ts`**

- [ ] Form renders from schema
- [ ] Dropdown shows enum options
- [ ] File upload field accepts files
- [ ] Validation errors display on submit

#### Additional Tests for New Features

**`api/omni-agent.test.ts`** _(OmniAgent Orchestrator)_

- [ ] Classifies legal question to legal-advisor agent
- [ ] Classifies ambiguous query and returns multiple alternatives
- [ ] Returns "no suitable agent" for unsupported domain
- [ ] Logs feature suggestions when fallback triggered

**`api/agent-chaining.test.ts`** _(Multi-Agent Chaining)_ _(Vertex AI mocked)_

- [ ] Executes 2-agent chain successfully
- [ ] Validates output at each step
- [ ] Fails chain if intermediate validation fails
- [ ] Returns combined result with source attribution

**`api/guided-interview.test.ts`** _(Guided Interview Mode)_

- [ ] Returns first question on interview start
- [ ] Advances to next question on valid answer
- [ ] Completes interview when all required context gathered
- [ ] Persists interview state per session

**`e2e/omni-agent.spec.ts`** _(AI response mocked)_

- [ ] "Ask OmniAI" appears first in agent selector
- [ ] User types query → appropriate agent suggested
- [ ] User confirms → redirected to agent chat

**`e2e/guided-interview.spec.ts`** _(AI response mocked)_

- [ ] Interview mode shows one question at a time
- [ ] Progress indicator updates
- [ ] "Start Analysis" enabled when complete

---

## Phase 3: Core Application – Query Flow & File Handling

**Goal:** Implement the end-to-end query flow: file uploads, prompt assembly, Vertex AI call, response validation, storage.

**Prerequisites:** Phase 2 complete. Agent schemas and templates defined.

### 3.1 File Upload (Signed URLs)

- [ ] **Request Upload URL:** `POST /api/upload/request` with `{ filename, mimeType, sizeBytes }`. Validate size limits (e.g., 10MB). Generate GCS signed URL for PUT. Return `{ uploadUrl, gcsPath, fileId }`.
- [ ] **Frontend Upload:** Use `fetch` with PUT to signed URL. Show progress indicator.
- [ ] **Confirm Upload:** Optionally call `POST /api/upload/confirm` to mark file ready. Store `ContextFile` record if org context, otherwise transient session file.
- [ ] **Validation:** Check allowed MIME types (PDF, images, text). Optionally scan for viruses (Cloud Function on GCS finalize).

### 3.2 Org Context Files

- [ ] **Upload Context:** `POST /api/org/:orgId/context` (admin only). Similar to user upload but stored with `orgId` and optional `agentIds` filter.
- [ ] **List Context:** `GET /api/org/:orgId/context` returns context files.
- [ ] **Delete Context:** `DELETE /api/org/:orgId/context/:fileId` removes file from GCS and DB.
- [ ] **UI:** Admin page section for context file management.

### 3.3 Query Orchestration API

- [ ] **Endpoint:** `POST /api/query`
  ```typescript
  interface QueryRequest {
    agentId: string;
    sessionId?: string; // Continue existing session
    inputs: Record<string, unknown>; // Per agent input schema
    files: { fieldName: string; gcsPath: string; filename: string }[];
  }
  ```
- [ ] **Implementation Flow:**
  1. **Authenticate:** Get user from session.
  2. **Authorize:** Cedar check for `QueryAgent` action.
  3. **Load Agent Config:** Get input/output schemas, prompt template, renderer.
  4. **Validate Input:** Parse `inputs` against agent's Zod Input Schema. Return 400 if invalid.
  5. **Check Quota:** Ensure user/org has tokens remaining. Return 402 if exhausted.
  6. **Process Files:** Generate signed URLs for each uploaded file.
  7. **Load Org Context:** If user has active org, fetch relevant `ContextFile` records and include snippets/URLs.
  8. **Compile Prompt:** Load Handlebars template, compile with context object:
     ```typescript
     const context = {
       ...validatedInputs,
       primaryContract: { filename: "...", url: signedUrl },
       supportingDocuments: [...],
       orgContext: orgContextText,
     };
     const prompt = Handlebars.compile(template)(context);
     ```
  9. **Call Vertex AI Agent Engine:**
     ```typescript
     const response = await agentEngineClient.query({
       agent: `projects/${PROJECT}/locations/global/agents/${agentId}`,
       sessionId: sessionId,
       userMessage: prompt,
       generationConfig: {
         responseMimeType: "application/json",
         responseSchema: zodToJsonSchema(OutputSchema),
       },
     });
     ```
  10. **Validate Output:** Parse response JSON against Output Schema. If invalid, log error and return graceful failure.
  11. **Render Markdown:** Call agent's renderer function.
  12. **Store Message:** Save to `Message` table with `jsonData` (structured) and `content` (Markdown).
  13. **Deduct Tokens:** Parse usage from response metadata, update user/org `tokensRemaining`.
  14. **Return Response:**
      ```typescript
      {
        sessionId: string;
        messageId: string;
        markdown: string;
        tokensUsed: number;
        tokensRemaining: number;
      }
      ```

### 3.4 Session Management

- [ ] **Create Session:** On first query with no `sessionId`, create new Session record.
- [ ] **Continue Session:** On subsequent queries, load session, append messages.
- [ ] **List Sessions:** `GET /api/sessions` returns user's sessions (with agent name, last message preview, timestamp).
- [ ] **Get Session:** `GET /api/sessions/:sessionId` returns full message history.

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

- [ ] **Component:** Sidebar listing agents (from `GET /api/agents`). Group by category if many. Show beta badge. Highlight selected agent.
- [ ] **Workspace Indicator:** Show current org context at top of sidebar.

### 4.2 Dynamic Input Form

- [ ] **Schema-Driven Form:** Use `react-hook-form` + `@hookform/resolvers/zod` + custom field renderer.
- [ ] **Field Types:**
  - `z.string()` → Text input
  - `z.enum([...])` → Select dropdown
  - `z.boolean()` → Checkbox
  - `z.instanceof(File)` → Single file upload
  - `z.array(z.instanceof(File))` → Multi-file upload
- [ ] **Descriptions:** Use `.describe()` metadata for labels and hints.
- [ ] **Submit Handler:** Validate, upload files, call `POST /api/query`.

### 4.3 Chat/Document Display

- [ ] **Markdown Renderer:** Use `react-markdown` with `remark-gfm`. Sanitize via `rehype-sanitize`.
- [ ] **Message List:** Show conversation history (user questions, agent responses).
- [ ] **Loading State:** Show typing indicator / spinner while awaiting response.
- [ ] **Streaming (Optional):** If backend supports SSE, stream response incrementally.

### 4.4 Highlight & Comment (Inline Follow-up)

- [ ] **Text Selection:** On mouseup in agent response, detect selection.
- [ ] **Tooltip:** Show "Ask about this" button near selection.
- [ ] **Follow-up Input:** Open popover with text area. Pre-fill with quoted text.
- [ ] **Submit:** Send as new query with context: `"Regarding: '{selectedText}'\n\nUser asks: {followUpQuestion}"`.
- [ ] **Display:** Show follow-up Q&A in threaded view or inline.

### 4.5 Session History & Revision

- [ ] **Session Selector:** Dropdown or sidebar list of past sessions.
- [ ] **Revision History:** If session has multiple agent responses, show version selector or timeline.
- [ ] **Diff View (Stretch):** Highlight changes between versions.

### 4.6 Chat Panel (Separate from Report)

> **Per DESIGN.md:** Two-panel UX: Document panel (main) for structured output + Chat panel (side) for unstructured Q&A.

- [ ] **Collapsible Chat Sidebar:** Right-side panel for free-form follow-up questions.
- [ ] **Chat vs Report Separation:** Chat is for clarifying discussion; Report is the polished structured output.
- [ ] **"Incorporate into Report" Button:** User can request agent to produce new report version incorporating chat discussion.
- [ ] **Chat History:** Persist chat separately from report revisions. Show user questions + agent replies in conversational format.
- [ ] **Sync State:** When chat updates report, mark in chat "✓ Incorporated into v3".

### 4.7 Export & Share

- [ ] **Export PDF:** Button triggers `renderToMarkdown` → `md-to-pdf` or Puppeteer server-side. Return download link.
- [ ] **Export DOCX:** Optional Word export for enterprise users.
- [ ] **Share Link:** `POST /api/share` creates shared artifact with UUID. Return link. Recipient can view (login required for MVP).
- [ ] **Share to Team/Org:** Option to share with entire team/org (changes artifact ACL).
- [ ] **Artifact Favorites/Pinning:** Users can pin/favorite artifacts for quick access. Show in "Favorites" section.
- [ ] **Artifact List View:** `GET /api/artifacts` returns user's artifacts. Filter by: favorites, recent, shared-with-me.

### 4.7 Phase 4 Test Requirements

#### Unit Tests (Vitest/Jest + React Testing Library)

**`components/sidebar.test.tsx`**

- [ ] Renders agent list from props
- [ ] Shows beta badge when `isBeta: true`
- [ ] Highlights selected agent
- [ ] Calls `onSelect` when agent clicked
- [ ] Shows workspace indicator

**`components/dynamic-form.test.tsx`**

- [ ] Renders text input for `z.string()`
- [ ] Renders dropdown for `z.enum()`
- [ ] Renders file upload for `z.instanceof(File)`
- [ ] Shows validation errors on submit
- [ ] Calls `onSubmit` with validated data

**`components/file-upload.test.tsx`**

- [ ] Accepts drag-drop files
- [ ] Shows progress during upload
- [ ] Displays error for oversized file
- [ ] Shows filename after upload

**`components/markdown-display.test.tsx`**

- [ ] Renders Markdown correctly
- [ ] Sanitizes XSS attempts
- [ ] Renders code blocks with syntax highlight
- [ ] Renders tables and lists

**`components/message-list.test.tsx`**

- [ ] Renders user and agent messages
- [ ] Shows loading indicator during query
- [ ] Scrolls to bottom on new message

**`components/highlight-comment.test.tsx`**

- [ ] Shows tooltip on text selection
- [ ] Opens popover on click
- [ ] Pre-fills selected text
- [ ] Calls `onSubmit` with follow-up

**`components/session-history.test.tsx`**

- [ ] Renders session list
- [ ] Shows agent name and timestamp
- [ ] Calls `onSelect` when clicked

**`components/export-share.test.tsx`**

- [ ] Export button triggers API call
- [ ] Share button opens modal
- [ ] Copy link button works

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

- [ ] **Checkout API:** `POST /api/billing/checkout` with `{ priceId, orgId? }`. Create Stripe Checkout Session. Return `sessionId`.
- [ ] **Frontend:** Redirect to Stripe Checkout using `stripe.redirectToCheckout({ sessionId })`.
- [ ] **Success/Cancel URLs:** Redirect back to app with status.

### 5.2 Stripe Webhooks

- [ ] **Endpoint:** `POST /api/stripe/webhook`. Verify signature.
- [ ] **Handle Events:**
  - `checkout.session.completed`: Link Stripe Customer to user/org. Set plan and tokens.
  - `invoice.payment_succeeded`: Reset token quota on renewal.
  - `invoice.payment_failed`: Notify user, possibly downgrade.
  - `customer.subscription.deleted`: Downgrade to free.
- [ ] **Token Top-Up:** Handle one-time purchases to add tokens.

### 5.3 Quota Enforcement

- [ ] **Pre-Query Check:** In query API, check `tokensRemaining > 0`. Return 402 with upgrade prompt if exhausted.
- [ ] **Post-Query Deduction:** Deduct actual tokens used. Persist immediately.
- [ ] **UI Indicator:** Show usage bar in header or account page. Warn when low.

### 5.4 Customer Portal

- [ ] **Portal API:** `POST /api/billing/portal` creates Stripe Customer Portal session. Return URL.
- [ ] **UI:** "Manage Subscription" button opens portal in new tab.

### 5.5 Phase 5 Test Requirements

#### Unit Tests (Vitest/Jest)

**`billing/checkout.test.ts`**

- [ ] Creates Stripe Checkout session
- [ ] Links to correct priceId
- [ ] Sets success/cancel URLs
- [ ] Returns 401 for unauthenticated

**`billing/webhook-signature.test.ts`**

- [ ] Validates correct signature
- [ ] Rejects invalid signature
- [ ] Rejects missing signature

**`billing/webhook-checkout.test.ts`**

- [ ] Links Stripe Customer to user
- [ ] Sets plan from price metadata
- [ ] Initializes token balance
- [ ] Handles org subscription

**`billing/webhook-renewal.test.ts`**

- [ ] Resets tokens on renewal
- [ ] Computes rollover correctly
- [ ] Respects rollover cap

**`billing/webhook-failure.test.ts`**

- [ ] Marks account as past due
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

- [ ] **Auth Review:** All protected routes check session. No exposed secrets.
- [ ] **AuthZ Review:** Cedar denies cross-tenant access. Test with malicious inputs.
- [ ] **Input Validation:** All inputs validated via Zod. No SQL/NoSQL injection.
- [ ] **XSS Prevention:** Markdown sanitized. CSP headers configured.
- [ ] **Dependency Audit:** `npm audit`, fix high severity issues.

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
