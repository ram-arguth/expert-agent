/**
 * Guided Interview API Tests
 *
 * Tests for the multi-turn context gathering API:
 * - Session management (with Prisma mocks)
 * - Question progression
 * - Answer validation
 * - Progress tracking
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";

// =============================================================================
// Mocks
// =============================================================================

const mockUserId = "test-user-123";
const mockSessionId = "interview-session-123";

// Mock Auth
vi.mock("@/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: mockUserId, email: "test@example.com" },
    }),
  ),
}));

// Mock Cedar
vi.mock("@/lib/authz/cedar", () => ({
  cedar: {
    isAuthorized: vi.fn(() => ({ isAuthorized: true })),
  },
  buildPrincipalFromSession: vi.fn(),
}));

// Mock Observability
vi.mock("@/lib/observability", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock Prisma
const mockSession = {
  id: mockSessionId,
  userId: mockUserId,
  agentId: "ux-analyst",
  metadata: {
    currentStepIndex: 0,
    answers: {},
  },
};

const prismaMock = vi.hoisted(() => ({
  session: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: prismaMock,
}));

// =============================================================================
// Helper Functions
// =============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/ux-analyst/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createParams(agentId: string) {
  return { params: Promise.resolve({ agentId }) };
}

// =============================================================================
// Tests
// =============================================================================

describe("Guided Interview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default Prisma behavior
    prismaMock.session.findUnique.mockResolvedValue(mockSession);
    prismaMock.session.create.mockResolvedValue(mockSession);
    prismaMock.session.update.mockImplementation((args) =>
      Promise.resolve({
        ...mockSession,
        ...args.data, // simplified merge
      }),
    );
  });

  describe("GET /api/agents/[agentId]/interview", () => {
    it("returns interview config for supported agent", async () => {
      const request = new NextRequest(
        "http://localhost/api/agents/ux-analyst/interview",
      );
      const response = await GET(request, createParams("ux-analyst"));
      const data = await response.json();

      expect(data.supported).toBe(true);
      expect(data.agentId).toBe("ux-analyst");
      expect(data.totalSteps).toBeGreaterThan(0);
    });

    it("returns supported=false for unsupported agent", async () => {
      const request = new NextRequest(
        "http://localhost/api/agents/unknown-agent/interview",
      );
      const response = await GET(request, createParams("unknown-agent"));
      const data = await response.json();

      expect(data.supported).toBe(false);
    });
  });

  describe("POST /api/agents/[agentId]/interview - Session Start", () => {
    it("creates new session via Prisma when no sessionId provided", async () => {
      // Setup mock to return new session
      prismaMock.session.create.mockResolvedValue({
        ...mockSession,
        metadata: { currentStepIndex: 0, answers: {} },
      });

      const request = createRequest({});
      const response = await POST(request, createParams("ux-analyst"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prismaMock.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUserId,
            agentId: "ux-analyst",
          }),
        }),
      );
      expect(data.sessionId).toBe(mockSessionId);
      expect(data.currentStep).toBe(1);
    });

    it("returns error for unsupported agent", async () => {
      const request = createRequest({});
      const response = await POST(request, createParams("unknown-agent"));
      expect(response.status).toBe(400); // Bad Request for unsupported agent
    });
  });

  describe("POST /api/agents/[agentId]/interview - Answer Processing", () => {
    it("accepts valid answer and updates Prisma", async () => {
      // Mock existing session at step 0
      prismaMock.session.findUnique.mockResolvedValue({
        ...mockSession,
        metadata: { currentStepIndex: 0, answers: {} },
      });

      const request = createRequest({
        sessionId: mockSessionId,
        answer: "web-app",
      });
      const response = await POST(request, createParams("ux-analyst"));
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify DB update
      expect(prismaMock.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockSessionId },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              currentStepIndex: 1,
              answers: { "product-type": "web-app" },
            }),
          }),
        }),
      );

      expect(data.currentStep).toBe(2);
    });

    it("rejects empty answer for required question", async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...mockSession,
        metadata: { currentStepIndex: 0, answers: {} },
      });

      const request = createRequest({
        sessionId: mockSessionId,
        answer: "",
      });
      const response = await POST(request, createParams("ux-analyst"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("required");
      expect(prismaMock.session.update).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/agents/[agentId]/interview - Session Management", () => {
    it("returns 404 for unknown session", async () => {
      prismaMock.session.findUnique.mockResolvedValue(null);

      const request = createRequest({
        sessionId: "nonexistent",
        answer: "test",
      });
      const response = await POST(request, createParams("ux-analyst"));

      expect(response.status).toBe(404);
    });

    it("returns 403 when accessing another users session", async () => {
      prismaMock.session.findUnique.mockResolvedValue({
        ...mockSession,
        userId: "other-user",
      });

      const request = createRequest({
        sessionId: mockSessionId,
        answer: "test",
      });
      const response = await POST(request, createParams("ux-analyst"));

      expect(response.status).toBe(403);
    });
  });
});
