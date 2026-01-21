import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { POST } from "@/app/api/omni/route/route";

// Mock dependencies
const mockUserId = "int-test-user-omni";
const mockEmail = "int-omni@example.com";

vi.mock("@/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: mockUserId, email: mockEmail },
    }),
  ),
}));

vi.mock("@/lib/authz/cedar", () => ({
  cedar: {
    isAuthorized: vi.fn(() => Promise.resolve({ isAuthorized: true })),
  },
  buildPrincipalFromSession: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/omni/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Omni Agent Integration", () => {
  beforeAll(async () => {
    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: {
        id: mockUserId,
        email: mockEmail,
        name: "Omni Test User",
        authProvider: "google",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: mockUserId } }).catch(() => {});
  });

  it("classifies legal query correctly", async () => {
    const request = createRequest({
      messages: [{ role: "user", content: "Review my NDA contract" }],
    });

    // Note: Omni route creates a session if successful
    // But route implementation might return redirect or JSON
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Based on keyword matching in current implementation
    expect(data.suggestedAgentId).toBe("legal-advisor");
    expect(data.confidence).toBeGreaterThan(0.5);
  });

  it("classifies ux query correctly", async () => {
    const request = createRequest({
      messages: [
        { role: "user", content: "Analyze the usability of my website" },
      ],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.suggestedAgentId).toBe("ux-analyst");
  });

  it("creates a session for the suggested agent", async () => {
    const request = createRequest({
      messages: [{ role: "user", content: "Budget planning help" }],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(data.sessionId).toBeDefined();

    // Verify session in DB
    const session = await prisma.session.findUnique({
      where: { id: data.sessionId },
    });
    expect(session).toBeDefined();
    expect(session?.agentId).toBe("finance-planner");
    expect(session?.userId).toBe(mockUserId);
  });
});
