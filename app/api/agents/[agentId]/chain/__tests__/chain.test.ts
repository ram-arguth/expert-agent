/**
 * Chain API Tests
 *
 * Tests for the multi-agent chain API endpoint.
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock Cedar
vi.mock("@/lib/authz/cedar", () => ({
  getCedarEngine: vi.fn(() => ({
    isAuthorized: vi.fn(() => ({ isAuthorized: true })),
  })),
  CedarActions: {
    QueryAgent: "QueryAgent",
  },
}));

// Helper to create mock request
function createMockRequest(options: {
  method: "GET" | "POST";
  body?: Record<string, unknown>;
}) {
  const url = "http://localhost:3000/api/agents/ux-analyst/chain";
  const request = new NextRequest(url, {
    method: options.method,
    ...(options.body && {
      body: JSON.stringify(options.body),
      headers: { "Content-Type": "application/json" },
    }),
  });
  return request;
}

// Helper to create route context
function createContext(agentId: string) {
  return {
    params: Promise.resolve({ agentId }),
  };
}

describe("GET /api/agents/:agentId/chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns chain targets for ux-analyst", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const request = createMockRequest({ method: "GET" });
    const response = await GET(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe("ux-analyst");
    expect(data.chainable).toBe(true);
    expect(Array.isArray(data.targets)).toBe(true);
    expect(data.targets.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty targets for unknown agent", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const request = createMockRequest({ method: "GET" });
    const response = await GET(request, createContext("unknown-agent"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agentId).toBe("unknown-agent");
    expect(data.chainable).toBe(false);
    expect(data.targets).toEqual([]);
  });

  it("indicates authentication status in response", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    const request = createMockRequest({ method: "GET" });
    const response = await GET(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(data.authenticated).toBe(true);
  });

  it("returns target details with mapperIds", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const request = createMockRequest({ method: "GET" });
    const response = await GET(request, createContext("ux-analyst"));
    const data = await response.json();

    const legalTarget = data.targets.find(
      (t: { targetAgentId: string }) => t.targetAgentId === "legal-advisor",
    );
    expect(legalTarget).toBeDefined();
    expect(legalTarget.mapperId).toBe("ux-to-legal");
    expect(legalTarget.description).toBeDefined();
    expect(typeof legalTarget.isLossy).toBe("boolean");
  });
});

describe("POST /api/agents/:agentId/chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValue(null);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        targetAgents: ["legal-advisor"],
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 when not authorized", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: false, reasons: ["Access denied"] }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        targetAgents: ["legal-advisor"],
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Forbidden");
  });

  it("returns 400 for invalid chain (no mapper)", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: true }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        // legal-advisor cannot chain to ux-analyst
        agentChain: ["legal-advisor", "ux-analyst"],
      },
    });

    const response = await POST(request, createContext("legal-advisor"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid Chain");
    expect(data.validation.valid).toBe(false);
  });

  it("executes valid chain successfully", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: true }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        targetAgents: ["legal-advisor"],
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.chainId).toBeDefined();
    expect(data.steps).toBeDefined();
    expect(data.steps.length).toBe(2);
    expect(data.finalOutput).toBeDefined();
    expect(data.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(data.totalTokenUsage).toBeDefined();
  });

  it("returns step-by-step results", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: true }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        targetAgents: ["legal-advisor", "finance-planner"],
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.steps.length).toBe(3);

    // Check each step has required fields
    for (const step of data.steps) {
      expect(step.agentId).toBeDefined();
      expect(step.success).toBe(true);
      expect(step.output).toBeDefined();
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
      expect(step.tokenUsage).toBeDefined();
    }
  });

  it("aggregates token usage across steps", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: true }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        targetAgents: ["legal-advisor"],
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(data.totalTokenUsage.total).toBeGreaterThan(0);
    expect(data.totalTokenUsage.input).toBeGreaterThan(0);
    expect(data.totalTokenUsage.output).toBeGreaterThan(0);
  });
});

describe("Chain Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects chain with less than 2 agents", async () => {
    const { auth } = await import("@/auth");
    const { getCedarEngine } = await import("@/lib/authz/cedar");

    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-123", email: "test@example.com" },
    } as never);

    vi.mocked(getCedarEngine).mockReturnValue({
      isAuthorized: () => ({ isAuthorized: true }),
      getStats: () => ({ policyCount: 1, evaluationCount: 1 }),
    } as never);

    const request = createMockRequest({
      method: "POST",
      body: {
        input: { test: true },
        agentChain: ["ux-analyst"], // Only 1 agent
      },
    });

    const response = await POST(request, createContext("ux-analyst"));
    const data = await response.json();

    expect(response.status).toBe(400);
  });
});
