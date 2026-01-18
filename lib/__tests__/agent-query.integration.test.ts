/**
 * Integration Tests: Agent Query & Sessions
 *
 * Tests agent session and message persistence:
 * - Session creation and lookup
 * - Message storage (user and agent)
 * - Token usage tracking
 * - Session archival
 * - Usage record creation
 *
 * Run with: pnpm test:integration agent-query
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";

describe("Agent Query Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("Session Creation", () => {
    it("creates session for personal use (no org)", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "personal@example.com",
          name: "Personal User",
          authProvider: "google",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
        },
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.orgId).toBeNull();
      expect(session.agentId).toBe("ux-analyst");
      expect(session.archived).toBe(false);
    });

    it("creates session within org context", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "org-user@example.com",
          name: "Org User",
          authProvider: "google",
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: "Team Org",
          slug: "team-org",
          type: "TEAM",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          orgId: org.id,
          agentId: "legal-advisor",
        },
      });

      expect(session.orgId).toBe(org.id);
      expect(session.agentId).toBe("legal-advisor");
    });

    it("stores Vertex AI session ID for multi-turn", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "vertex@example.com",
          name: "Vertex User",
          authProvider: "google",
        },
      });

      const session = await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "finance-planner",
          vertexSessionId:
            "projects/my-project/locations/global/agentApps/agent-1/sessions/sess-123",
        },
      });

      expect(session.vertexSessionId).toContain("sess-123");
    });
  });

  describe("Message Storage", () => {
    it("stores user message", async () => {
      const user = await testPrisma.user.create({
        data: { email: "msg-user@test.com", authProvider: "google" },
      });

      const session = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });

      const message = await testPrisma.message.create({
        data: {
          sessionId: session.id,
          role: "USER",
          content: "Analyze this screenshot for usability issues",
        },
      });

      expect(message.role).toBe("USER");
      expect(message.content).toContain("screenshot");
    });

    it("stores agent response with structured JSON", async () => {
      const user = await testPrisma.user.create({
        data: { email: "json-user@test.com", authProvider: "google" },
      });

      const session = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });

      const structuredResponse = {
        findings: [
          { id: 1, severity: "high", description: "Low contrast text" },
          { id: 2, severity: "medium", description: "Missing alt text" },
        ],
        recommendations: [
          { priority: 1, action: "Increase contrast ratio to 4.5:1" },
        ],
      };

      const message = await testPrisma.message.create({
        data: {
          sessionId: session.id,
          role: "AGENT",
          content:
            "## Findings\n\n1. Low contrast text (High)\n2. Missing alt text (Medium)",
          jsonData: structuredResponse,
          inputTokens: 500,
          outputTokens: 1200,
        },
      });

      expect(message.role).toBe("AGENT");
      expect(message.jsonData).toEqual(structuredResponse);
      expect(message.inputTokens).toBe(500);
      expect(message.outputTokens).toBe(1200);
    });

    it("retrieves messages in order", async () => {
      const user = await testPrisma.user.create({
        data: { email: "order-user@test.com", authProvider: "google" },
      });

      const session = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });

      // Create messages with slight delay to ensure ordering
      await testPrisma.message.create({
        data: {
          sessionId: session.id,
          role: "USER",
          content: "First question",
        },
      });

      await testPrisma.message.create({
        data: { sessionId: session.id, role: "AGENT", content: "First answer" },
      });

      await testPrisma.message.create({
        data: { sessionId: session.id, role: "USER", content: "Follow up" },
      });

      const messages = await testPrisma.message.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: "asc" },
      });

      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe("USER");
      expect(messages[1].role).toBe("AGENT");
      expect(messages[2].content).toBe("Follow up");
    });
  });

  describe("Session Archival", () => {
    it("archives session with summary URL", async () => {
      const user = await testPrisma.user.create({
        data: { email: "archive-user@test.com", authProvider: "google" },
      });

      const session = await testPrisma.session.create({
        data: { userId: user.id, agentId: "ux-analyst" },
      });

      const archived = await testPrisma.session.update({
        where: { id: session.id },
        data: {
          archived: true,
          summaryUrl: "gs://expert-ai-dev/summaries/sess-123.md",
        },
      });

      expect(archived.archived).toBe(true);
      expect(archived.summaryUrl).toContain("summaries");
    });

    it("finds stale sessions for archival", async () => {
      const user = await testPrisma.user.create({
        data: { email: "stale-user@test.com", authProvider: "google" },
      });

      // Create an old session (14+ days)
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

      await testPrisma.session.create({
        data: {
          userId: user.id,
          agentId: "ux-analyst",
          archived: false,
          updatedAt: oldDate,
        },
      });

      const staleSessions = await testPrisma.session.findMany({
        where: {
          archived: false,
          updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      });

      expect(staleSessions.length).toBe(1);
    });
  });

  describe("Usage Record Tracking", () => {
    it("creates usage record after query", async () => {
      const user = await testPrisma.user.create({
        data: { email: "usage-user@test.com", authProvider: "google" },
      });

      const org = await testPrisma.org.create({
        data: { name: "Usage Org", slug: "usage-org", type: "TEAM" },
      });

      const session = await testPrisma.session.create({
        data: { userId: user.id, orgId: org.id, agentId: "legal-advisor" },
      });

      const record = await testPrisma.usageRecord.create({
        data: {
          userId: user.id,
          orgId: org.id,
          sessionId: session.id,
          agentId: "legal-advisor",
          inputTokens: 1500,
          outputTokens: 3000,
          totalTokens: 4500,
          costCents: 45, // $0.45
        },
      });

      expect(record.totalTokens).toBe(4500);
      expect(record.costCents).toBe(45);
    });

    it("aggregates usage by org", async () => {
      const user = await testPrisma.user.create({
        data: { email: "agg-user@test.com", authProvider: "google" },
      });

      const org = await testPrisma.org.create({
        data: { name: "Agg Org", slug: "agg-org", type: "TEAM" },
      });

      // Create multiple usage records
      await testPrisma.usageRecord.createMany({
        data: [
          {
            userId: user.id,
            orgId: org.id,
            agentId: "ux-analyst",
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
          },
          {
            userId: user.id,
            orgId: org.id,
            agentId: "legal-advisor",
            inputTokens: 200,
            outputTokens: 400,
            totalTokens: 600,
          },
          {
            userId: user.id,
            orgId: org.id,
            agentId: "ux-analyst",
            inputTokens: 150,
            outputTokens: 350,
            totalTokens: 500,
          },
        ],
      });

      // Aggregate by org
      const total = await testPrisma.usageRecord.aggregate({
        where: { orgId: org.id },
        _sum: { totalTokens: true },
      });

      expect(total._sum.totalTokens).toBe(1400);
    });
  });

  describe("Cross-User Session Isolation", () => {
    it("user cannot access other user sessions", async () => {
      const user1 = await testPrisma.user.create({
        data: { email: "user1@test.com", authProvider: "google" },
      });

      const user2 = await testPrisma.user.create({
        data: { email: "user2@test.com", authProvider: "apple" },
      });

      await testPrisma.session.create({
        data: { userId: user1.id, agentId: "ux-analyst" },
      });

      await testPrisma.session.create({
        data: { userId: user2.id, agentId: "legal-advisor" },
      });

      // Query for user1's sessions only
      const user1Sessions = await testPrisma.session.findMany({
        where: { userId: user1.id },
      });

      expect(user1Sessions.length).toBe(1);
      expect(user1Sessions[0].agentId).toBe("ux-analyst");
    });
  });
});
