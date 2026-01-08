<!-- File: GEMINI.md -->

# Expert Agent Framework – Workspace Rules

This file defines workspace-specific configuration for AI assistants working in this repository.

- The **global rules** apply unless they conflict with this file.
- This **workspace file overrides** the global file on project-specific matters.
- Safety and platform/system policies always override everything.

---

## 1. Project Overview & Goal

You are working on **Expert Agent**, a generalized AI agent framework for domain-specific expertise.

High-level characteristics:

- **Framework Design**: Provides reusable patterns for building expert AI agents
- **Domain Agnostic**: Not locked to any specific domain (UX, code review, security, etc.)
- **Gemini 3 Native**: Built exclusively for Gemini 3 Pro capabilities
- **Multimodal**: Supports images, PDFs, text, and other artifacts

Primary value proposition:

- Enable rapid creation of **domain-specific expert agents** by providing:
  - Configurable prompt templates
  - Multimodal input handling
  - Structured output generation
  - Context caching and session management

---

## 2. Technology and Architecture Preferences

### 2.1 Stack and Frameworks

Unless the repository clearly uses a different stack:

- Prefer **TypeScript** for all new code
- Consider **Next.js with React** for web interfaces
- Consider **Python** for CLI tools or standalone agents
- Default assumption: modern versions with latest stable patterns

Always state your assumption (e.g., "Assuming Python 3.12; adjust if your version differs.").

### 2.2 Project Structure

Recommend a clear, maintainable structure:

- `src/` – Core source code
  - `agents/` – Agent definitions and configurations
  - `prompts/` – Prompt templates
  - `lib/` – Shared utilities
  - `types/` – Shared type definitions
- `docs/` – Documentation
- `experiments/` – Validation and testing experiments
- `examples/` – Example agent implementations

Keep **separation of concerns**:

- Domain logic vs framework utilities
- Configuration vs implementation

### 2.3 AI Integration

#### 2.3.1 Mandatory Gemini 3 Model Requirement

> **HARD REQUIREMENT**: ALL AI operations MUST use Gemini 3 Pro (`gemini-3-pro-preview`).
> There are **NO EXCEPTIONS** for using older model versions.

> [!CAUTION] > **ALWAYS USE GEMINI 3 PRO.**
> This project uses the latest Gemini 3 model exclusively:
>
> - **Model name**: `gemini-3-pro-preview`
> - **Flash variant**: `gemini-3-flash-preview` (for lightweight operations only)
> - **Location**: `global` (NOT `us-central1` - Gemini 3 preview uses global endpoint)
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

#### 2.3.2 AI Client Design

Create a focused AI client module that:

- Encapsulates calls to Gemini APIs via `@google/genai` SDK
- Uses Application Default Credentials (ADC) for authentication
- Handles retries and basic error mapping
- Supports context caching for efficient multi-turn conversations

```typescript
// Example AI client initialization
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: "global", // Required for Gemini 3
});
```

### 2.4 Non-Functional Requirements

- **Robust error handling**: Clear user-facing messages
- **Structured logging**: JSON logs without sensitive content
- **Observability**: Metrics and tracing for performance analysis

---

## 3. Code Quality Standards

### 3.1 Mandatory Testing Requirements

> **HARD REQUIREMENT**: ALL feature additions and changes MUST include appropriate test coverage.

> [!CAUTION] > **NEVER ship code without tests.**
> Every feature addition or change requires:
>
> - **Unit Tests**: Test individual functions and components in isolation
> - **Integration Tests**: Test API interactions and data flow
> - **E2E Tests**: Test critical user flows end-to-end
>
> **What is NEVER acceptable:**
>
> - Adding features without corresponding tests
> - Modifying behavior without updating existing tests
> - Shipping "we'll add tests later" code
> - Skipping tests because "it's a small change"

#### Test Types Required

| Change Type            | Unit Tests | Integration Tests | E2E Tests      |
| :--------------------- | :--------- | :---------------- | :------------- |
| New agent type         | Required   | Required          | If user-facing |
| Prompt template change | Required   | Required          | Required       |
| Library utility        | Required   | If API-related    | -              |
| Bug fix                | Required   | If API-related    | If UI-related  |

---

### 3.2 Production-Ready Code Policy (No Placeholders)

> **HARD REQUIREMENT**: ALL code must be 100% complete and production-ready.
> There are **NO EXCEPTIONS** for placeholders, stubs, or "TODO" implementations.

> [!CAUTION] > **NEVER write placeholder or shortcut code.**
> Every feature implementation must be complete and functional:
>
> - **Fully working functionality**: Every function must do exactly what it claims
> - **No "will add later" comments**: If mentioned, it must be implemented NOW
> - **No mocked/stubbed functionality**: No fake implementations
> - **No placeholder text**: Write the real labels/messages
>
> **What is NEVER acceptable:**
>
> - `// TODO: implement this later`
> - `// For now, mark as completed (actual processing can be added later)`
> - `return { success: true }; // Fake success for now`
> - Any comment suggesting "temporary" or "placeholder" code

#### How to Handle Complex Features

If a feature is too complex to implement fully in a single change:

1. **Implement the minimum viable COMPLETE version first** - not a placeholder
2. **Split into multiple complete pieces** - each piece must be fully functional
3. **If truly cannot implement now**, ask the user instead of adding a placeholder

---

## 4. Infrastructure & Deployment

### 4.1 Infrastructure-as-Code Policy

> [!CAUTION] > **ALWAYS USE TERRAFORM VIA CI/CD. NEVER RUN MANUAL `terraform apply` OR `gcloud` COMMANDS.**
>
> For **ANY** infrastructure change:
>
> 1. **Define it in Terraform FIRST**
> 2. **Deploy ONLY via CI/CD**
> 3. **NEVER run `terraform apply` locally**
> 4. **NEVER run ad-hoc `gcloud` commands**
>
> This is a **HARD REQUIREMENT** with **NO EXCEPTIONS**.

### 4.2 Git Branch Workflow

> **HARD REQUIREMENT**: Keep `main` branch clean with squash-merged commits only.
> Do NOT merge to `main` without explicit user approval.

**Workflow for incremental work:**

1. **All work on `dev` branch** - commit and push all incremental changes
2. **Wait for explicit approval** - do NOT move `main` forward until user asks
3. **Squash merge to `main`** - when requested, with comprehensive commit message

**What is acceptable:**

- ✅ Commit and push to `dev` branch
- ✅ Multiple incremental commits on `dev`

**What is NOT acceptable:**

- ❌ Merging to `main` without explicit user request
- ❌ Fast-forward merging `dev` to `main` (use squash merge only)

---

## 5. Domain Configuration Pattern

Expert Agent uses a configuration-driven approach to define domain expertise:

### 5.1 Domain Definition Structure

```typescript
interface DomainConfig {
  // Identity
  name: string; // e.g., "UX Analyst", "Code Reviewer"
  description: string; // Brief description of expertise

  // Expertise
  systemPrompt: string; // Core prompt defining the expert persona
  knowledgeBase?: string; // Path to domain knowledge document

  // Evaluation
  criteria: EvaluationCriterion[]; // What to evaluate
  severityLevels: SeverityLevel[]; // How to rate issues

  // Output
  reportSchema: ReportSchema; // Structure of output
  outputFormat: "markdown" | "json" | "both";
}
```

### 5.2 Prompt Template Pattern

All domain prompts should follow this structure:

1. **Role Definition**: "You are an expert [domain] analyst..."
2. **Primary Goals**: Clear objectives for the analysis
3. **Grounding Rules**: How to handle uncertainty and evidence
4. **Input Sections**: Clearly tagged input blocks (<CONTEXT>, <MATERIALS>, etc.)
5. **Output Format**: Explicit structure for responses

---

## 6. Observability

### 6.1 OpenTelemetry Tracing

> **REQUIREMENT**: All significant operations MUST include OpenTelemetry tracing.

What MUST be traced:

| Operation Type  | How to Trace                                  |
| :-------------- | :-------------------------------------------- |
| AI/LLM Calls    | Wrap with span, include `gen_ai.*` attributes |
| File Processing | Wrap with span, track processing time         |
| External APIs   | Use `SpanKind.CLIENT`                         |

### 6.2 Logging with Trace Correlation

ALL logs at INFO level or above SHOULD include trace context:

```typescript
logger.info({ traceId, spanId, ... }, 'Operation description');
```

---

## 7. Security

### 7.1 Authentication

- Use **Application Default Credentials (ADC)** for GCP services
- Support **SSO** for web interfaces (Google, GitHub providers)
- **No credentials/passwords** stored in code or config files

### 7.2 Authorization

- **Deny-by-default**: All operations require explicit permission
- **Audit logging**: All authorization decisions logged
- **Service accounts**: Use specific SAs with minimal permissions

---

## 8. Example: Creating a New Domain Agent

To create a new domain expert (e.g., "Security Auditor"):

1. Create domain config in `src/agents/security-auditor/config.ts`
2. Create prompt template in `src/prompts/security-auditor.template.md`
3. Define evaluation criteria and severity levels
4. Create tests for the new agent
5. Add example in `examples/security-auditor/`

See existing agents for reference patterns.
