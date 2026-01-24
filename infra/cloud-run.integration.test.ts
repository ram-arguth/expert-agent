import { describe, it, expect, beforeAll } from "vitest";

/**
 * Cloud Run Smoke Tests
 *
 * Verified critical infrastructure connectivity after deployment:
 * 1. Health Check (Basic reachability)
 * 2. Database Access (Public API that uses DB)
 * 3. Secret Manager & GCS Access (Authenticated API that uses Secrets + GCS)
 *
 * Usage:
 * SERVICE_URL=https://ai-dev.oz.ly E2E_TEST_SECRET=... pnpm test:integration infra/cloud-run.integration.test.ts
 */
describe("Cloud Run Smoke Tests", () => {
  const serviceUrl = process.env.SERVICE_URL || "http://localhost:3000";
  const e2eSecret = process.env.E2E_TEST_SECRET;

  console.log(`Running smoke tests against: ${serviceUrl}`);

  beforeAll(() => {
    if (!serviceUrl) {
      throw new Error("SERVICE_URL environment variable is required");
    }
    // We don't throw for missing E2E_TEST_SECRET to allow health check only runs
    if (!e2eSecret) {
      console.warn(
        "E2E_TEST_SECRET not provided: Authenticated tests will be skipped/failed",
      );
    }
  });

  it("Health Check: Should return 200 OK", async () => {
    const response = await fetch(`${serviceUrl}/api/health`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("environment");
  });

  it("Database Access: Should list public agents", async () => {
    // /api/agents is a public endpoint that queries the database
    const response = await fetch(`${serviceUrl}/api/agents`);
    expect(response.status).toBe(200);

    const agents = await response.json();
    expect(Array.isArray(agents)).toBe(true);
    // We expect at least one agent (e.g. system agent or seeded agents)
    expect(agents.length).toBeGreaterThan(0);
  });

  it("Infrastructure Access: Should verify Secrets & GCS via Upload API", async () => {
    if (!e2eSecret) {
      console.warn(
        "Skipping Infrastructure Access test due to missing E2E_TEST_SECRET",
      );
      return;
    }

    // 1. Authenticate as Test Principal via Headers
    const testPrincipal = {
      id: "smoke-test-user",
      email: "smoke-test@oz.ly",
      name: "Smoke Test User",
      provider: "google",
    };

    // 2. Request Upload URL (Uses Secret Manager for keys, GCS for URL generation)
    // This is a great integration test because it touches:
    // - Auth Middleware (validating the test principal)
    // - Secret Manager (for E2E secret verification inside middleware)
    // - GCS Client (initialized with creds from env/metadata)
    // - Database (Quota checks, though purely strictly upload might check quota first)

    const uploadPayload = {
      filename: "smoke-test.txt",
      mimeType: "text/plain",
      sizeBytes: 1024,
    };

    const response = await fetch(`${serviceUrl}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-E2E-Test-Principal": JSON.stringify(testPrincipal),
        "X-E2E-Test-Secret": e2eSecret,
      },
      body: JSON.stringify(uploadPayload),
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error("Upload API Error:", errorText);
    }

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("uploadUrl");
    expect(data).toHaveProperty("gcsPath");
    expect(data.uploadUrl).toContain("storage.googleapis.com"); // Or local equivalent
  });
});
