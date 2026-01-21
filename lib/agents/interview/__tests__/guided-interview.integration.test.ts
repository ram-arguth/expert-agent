import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterAll,
  beforeAll,
} from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { POST } from "@/app/api/agents/[agentId]/interview/route";

// Mock dependencies
const mockUserId = "int-test-user-interview";
const mockEmail = "int-interview@example.com";

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

// Suppress logs
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
  return new NextRequest("http://localhost/api/agents/ux-analyst/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createParams(agentId: string) {
  return { params: Promise.resolve({ agentId }) };
}

describe("Guided Interview Integration", () => {
  const createdSessionIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: mockUserId },
      update: {},
      create: {
        id: mockUserId,
        email: mockEmail,
        name: "Integration Test User",
        authProvider: "google",
      },
    });
  });

  afterAll(async () => {
    // Cleanup sessions
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      });
    }
    // Cleanup user
    await prisma.user.delete({ where: { id: mockUserId } }).catch(() => {});
  });

  it("persists session state to database", async () => {
    // 1. Start new session
    const startReq = createRequest({});
    const startRes = await POST(startReq, createParams("ux-analyst"));
    const startData = await startRes.json();

    expect(startRes.status).toBe(200);
    expect(startData.sessionId).toBeDefined();
    createdSessionIds.push(startData.sessionId);

    // Verify DB record created
    const sessionRecord = await prisma.session.findUnique({
      where: { id: startData.sessionId },
    });
    expect(sessionRecord).toBeDefined();
    expect(sessionRecord?.agentId).toBe("ux-analyst");
    expect(sessionRecord?.userId).toBe(mockUserId);

    const metadata = sessionRecord?.metadata as any;
    expect(metadata.currentStepIndex).toBe(0);

    // 2. Submit Answer
    const answerReq = createRequest({
      sessionId: startData.sessionId,
      answer: "web-app",
    });
    const answerRes = await POST(answerReq, createParams("ux-analyst"));
    expect(answerRes.status).toBe(200);

    // Verify DB record updated
    const updatedRecord = await prisma.session.findUnique({
      where: { id: startData.sessionId },
    });
    const updatedMeta = updatedRecord?.metadata as any;

    expect(updatedMeta.currentStepIndex).toBe(1);
    expect(updatedMeta.answers).toHaveProperty("product-type", "web-app");
  });

  it("resumes session key from database state", async () => {
    // 1. Create session manually in DB to simulate "previous state"
    const manualSession = await prisma.session.create({
      data: {
        userId: mockUserId,
        agentId: "ux-analyst",
        metadata: {
          currentStepIndex: 1,
          answers: { "product-type": "web-app" },
        },
      },
    });
    createdSessionIds.push(manualSession.id);

    // 2. Request with this sessionId (no answer) -> should return status
    const resumeReq = createRequest({ sessionId: manualSession.id });
    const resumeRes = await POST(resumeReq, createParams("ux-analyst"));
    const resumeData = await resumeRes.json();

    expect(resumeData.currentStep).toBe(2); // Should be step 2 (index 1 + 1)
    expect(resumeData.answers).toHaveProperty("product-type", "web-app");
  });
});
