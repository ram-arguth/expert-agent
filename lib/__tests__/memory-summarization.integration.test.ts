/**
 * Integration Tests: Memory Summarization
 *
 * Tests end-to-end summarization of old sessions:
 * - Stale session detection
 * - Summary storage to GCS
 * - Session archival
 * - Summary retrieval for resume
 *
 * Run with: pnpm test:integration memory-summarization
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.5 (lines 1510-1515)
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";

// Mock GCS Storage for integration tests
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockDownload = vi.fn().mockResolvedValue([
  Buffer.from(
    JSON.stringify({
      agentId: "ux-analyst",
      messageCount: 5,
      summary: "Test session summary for integration tests",
      archivedAt: new Date().toISOString(),
      version: "1.0",
    }),
  ),
]);

vi.mock("@google-cloud/storage", () => ({
  Storage: class MockStorage {
    bucket() {
      return {
        file: () => ({
          save: mockSave,
          download: mockDownload,
        }),
      };
    }
  },
}));

// Import after mocking
import {
  findSessionsToSummarize,
  generateSessionSummary,
  archiveSession,
  summarizeBatch,
  loadSessionSummary,
} from "@/lib/memory/summarization-service";

describe("Memory Summarization Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
  });

  describe("Stale Session Detection", () => {
    it("detects sessions older than 14 days for summarization", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "stale-test@example.com",
          name: "Stale Test User",
          authProvider: "google",
        },
      });

      // Create an old session (15 days ago)
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

      const oldSession = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
          archived: false,
        },
      });

      // Update the updatedAt manually to simulate old session
      await testPrisma.$executeRaw`
        UPDATE "Session" SET "updatedAt" = ${oldDate} WHERE id = ${oldSession.id}
      `;

      // Create a fresh session (should NOT be detected)
      await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "legal-advisor",
          archived: false,
        },
      });

      const staleSessions = await findSessionsToSummarize(10);

      expect(staleSessions.length).toBe(1);
      expect(staleSessions[0].id).toBe(oldSession.id);
      expect(staleSessions[0].agentId).toBe("ux-analyst");
    });

    it("excludes already archived sessions", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "archived-test@example.com",
          authProvider: "google",
        },
      });

      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

      // Create an old but already archived session
      const archivedSession = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
          archived: true,
          summaryUrl: "gs://bucket/summary.json",
        },
      });

      await testPrisma.$executeRaw`
        UPDATE "Session" SET "updatedAt" = ${oldDate} WHERE id = ${archivedSession.id}
      `;

      const staleSessions = await findSessionsToSummarize(10);
      expect(staleSessions.length).toBe(0);
    });
  });

  describe("Summary Generation and Storage", () => {
    it("generates summary and stores to GCS with URL in DB", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "gcs-test@example.com",
          authProvider: "google",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
        },
      });

      // Add some messages to summarize
      await testPrisma.message.createMany({
        data: [
          { sessionId: session.id, role: "USER", content: "Analyze this UI" },
          {
            sessionId: session.id,
            role: "AGENT",
            content: "I found 3 usability issues",
          },
          {
            sessionId: session.id,
            role: "USER",
            content: "What about colors?",
          },
          {
            sessionId: session.id,
            role: "AGENT",
            content: "The contrast ratio is low",
          },
        ],
      });

      // Generate summary
      const summaryJson = await generateSessionSummary(session.id);
      expect(summaryJson).toContain("ux-analyst");
      expect(summaryJson).toContain("messageCount");

      // Archive session (stores to GCS)
      const summaryUrl = await archiveSession(session.id, summaryJson);

      expect(summaryUrl).toContain("gs://");
      expect(summaryUrl).toContain(session.id);
      expect(mockSave).toHaveBeenCalledOnce();

      // Verify DB was updated
      const updatedSession = await testPrisma.session.findUnique({
        where: { id: session.id },
      });
      expect(updatedSession?.archived).toBe(true);
      expect(updatedSession?.summaryUrl).toBe(summaryUrl);
    });

    it("stores summary with correct content type and metadata", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "metadata-test@example.com",
          authProvider: "apple",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "legal-advisor",
        },
      });

      await testPrisma.message.create({
        data: {
          sessionId: session.id,
          role: "USER",
          content: "Review this contract",
        },
      });

      const summaryJson = await generateSessionSummary(session.id);
      await archiveSession(session.id, summaryJson);

      // Verify GCS save was called with proper options
      expect(mockSave).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contentType: "application/json",
          metadata: expect.objectContaining({
            sessionId: session.id,
          }),
        }),
      );
    });
  });

  describe("Archived Session Messages", () => {
    it("retains messages after session archival", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "retain-test@example.com",
          authProvider: "google",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "finance-planner",
        },
      });

      // Create messages
      await testPrisma.message.createMany({
        data: [
          { sessionId: session.id, role: "USER", content: "Plan my budget" },
          {
            sessionId: session.id,
            role: "AGENT",
            content: "Here is your budget analysis",
            jsonData: { budget: { total: 5000, categories: [] } },
          },
        ],
      });

      // Archive the session
      const summary = await generateSessionSummary(session.id);
      await archiveSession(session.id, summary);

      // Verify messages are still accessible
      const messages = await testPrisma.message.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
      });

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe("Plan my budget");
      expect(messages[1].jsonData).toEqual({
        budget: { total: 5000, categories: [] },
      });
    });

    it("can query messages by session after archival", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "query-archived@example.com",
          authProvider: "msa",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
        },
      });

      await testPrisma.message.createMany({
        data: [
          { sessionId: session.id, role: "USER", content: "Q1" },
          { sessionId: session.id, role: "AGENT", content: "A1" },
          { sessionId: session.id, role: "USER", content: "Q2" },
          { sessionId: session.id, role: "AGENT", content: "A2" },
        ],
      });

      // Archive
      const summary = await generateSessionSummary(session.id);
      await archiveSession(session.id, summary);

      // Query the archived session with messages
      const archivedSession = await testPrisma.session.findUnique({
        where: { id: session.id },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      expect(archivedSession?.archived).toBe(true);
      expect(archivedSession?.messages.length).toBe(4);
    });
  });

  describe("Resume Archived Session", () => {
    it("loads summary from GCS for archived session", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "resume-test@example.com",
          authProvider: "google",
        },
      });

      // Create and archive a session
      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
          archived: true,
          summaryUrl: "gs://expert-ai-summaries/summaries/test-session.json",
        },
      });

      // Load summary
      const summary = await loadSessionSummary(session.id);

      expect(summary).not.toBeNull();
      expect(summary).toContain("ux-analyst");
      expect(summary).toContain("summary");
      expect(mockDownload).toHaveBeenCalledOnce();
    });

    it("returns null for non-archived session", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "active-test@example.com",
          authProvider: "google",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "legal-advisor",
          archived: false,
        },
      });

      const summary = await loadSessionSummary(session.id);
      expect(summary).toBeNull();
    });

    it("returns null for archived session without summaryUrl", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "nosummary-test@example.com",
          authProvider: "apple",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "finance-planner",
          archived: true,
          summaryUrl: null,
        },
      });

      const summary = await loadSessionSummary(session.id);
      expect(summary).toBeNull();
    });
  });

  describe("Batch Summarization", () => {
    it("processes multiple stale sessions in batch", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "batch-test@example.com",
          authProvider: "google",
        },
      });

      const oldDate = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);

      // Create multiple old sessions
      const session1 = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });
      const session2 = await testPrisma.session.create({
        data: { userId: user.id, agentId: "legal-advisor" },
      });

      // Add messages
      await testPrisma.message.create({
        data: { sessionId: session1.id, role: "USER", content: "Test 1" },
      });
      await testPrisma.message.create({
        data: { sessionId: session2.id, role: "USER", content: "Test 2" },
      });

      // Age the sessions
      await testPrisma.$executeRaw`
        UPDATE "Session" SET "updatedAt" = ${oldDate} 
        WHERE id IN (${session1.id}, ${session2.id})
      `;

      // Run batch summarization
      const result = await summarizeBatch(10);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);

      // Verify both sessions are archived
      const archived1 = await testPrisma.session.findUnique({
        where: { id: session1.id },
      });
      const archived2 = await testPrisma.session.findUnique({
        where: { id: session2.id },
      });

      expect(archived1?.archived).toBe(true);
      expect(archived2?.archived).toBe(true);
    });

    it("handles partial failures gracefully", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "partial-test@example.com",
          authProvider: "google",
        },
      });

      const oldDate = new Date(Date.now() - 17 * 24 * 60 * 60 * 1000);

      // Create a session with messages (will succeed)
      const goodSession = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });
      await testPrisma.message.create({
        data: { sessionId: goodSession.id, role: "USER", content: "Good msg" },
      });

      // Create a session without messages (will fail in generateSessionSummary)
      const emptySession = await testPrisma.session.create({
        data: { userId: user.id, agentId: "legal-advisor" },
      });

      // Age both sessions
      await testPrisma.$executeRaw`
        UPDATE "Session" SET "updatedAt" = ${oldDate} 
        WHERE id IN (${goodSession.id}, ${emptySession.id})
      `;

      const result = await summarizeBatch(10);

      // Both should be processed (one succeeds, one may succeed with empty messages)
      expect(result.processed).toBe(2);
      expect(result.results).toHaveLength(2);
    });
  });
});
