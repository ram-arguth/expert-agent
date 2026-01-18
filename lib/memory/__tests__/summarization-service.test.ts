/**
 * Memory Summarization Service Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findSessionsToSummarize,
  generateSessionSummary,
  archiveSession,
  summarizeBatch,
  loadSessionSummary,
} from "../summarization-service";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock GCS with class pattern
vi.mock("@google-cloud/storage", () => ({
  Storage: class MockStorage {
    bucket() {
      return {
        file: () => ({
          save: vi.fn().mockResolvedValue(undefined),
          download: vi
            .fn()
            .mockResolvedValue([Buffer.from('{"summary":"test"}')]),
        }),
      };
    }
  },
}));

import { prisma } from "@/lib/db";
import type { Mock } from "vitest";

const mockFindMany = prisma.session.findMany as Mock;
const mockFindUnique = prisma.session.findUnique as Mock;
const mockUpdate = prisma.session.update as Mock;

describe("Memory Summarization Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findSessionsToSummarize", () => {
    it("returns sessions older than 14 days that are not archived", async () => {
      const oldSessions = [
        {
          id: "session-1",
          userId: "user-1",
          agentId: "ux-analyst",
          createdAt: new Date(),
        },
        {
          id: "session-2",
          userId: "user-1",
          agentId: "legal-advisor",
          createdAt: new Date(),
        },
      ];
      mockFindMany.mockResolvedValue(oldSessions);

      const result = await findSessionsToSummarize(10);

      expect(result).toEqual(oldSessions);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archived: false,
          }),
          take: 10,
        }),
      );
    });

    it("respects the limit parameter", async () => {
      mockFindMany.mockResolvedValue([]);

      await findSessionsToSummarize(25);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        }),
      );
    });

    it("orders by updatedAt ascending (oldest first)", async () => {
      mockFindMany.mockResolvedValue([]);

      await findSessionsToSummarize();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: "asc" },
        }),
      );
    });
  });

  describe("generateSessionSummary", () => {
    it("generates summary for a session with messages", async () => {
      mockFindUnique.mockResolvedValue({
        id: "session-1",
        agentId: "ux-analyst",
        messages: [
          { role: "user", content: "Hello", createdAt: new Date() },
          { role: "assistant", content: "Hi there!", createdAt: new Date() },
        ],
      });

      const summary = await generateSessionSummary("session-1");

      expect(summary).toContain("ux-analyst");
      expect(summary).toContain("messageCount");
    });

    it("throws error for non-existent session", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(generateSessionSummary("invalid-id")).rejects.toThrow(
        "Session invalid-id not found",
      );
    });
  });

  describe("archiveSession", () => {
    it("saves summary to GCS and updates session", async () => {
      mockUpdate.mockResolvedValue({ id: "session-1", archived: true });

      const result = await archiveSession("session-1", '{"summary":"test"}');

      expect(result).toContain("gs://");
      expect(result).toContain("session-1.json");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "session-1" },
          data: expect.objectContaining({
            archived: true,
          }),
        }),
      );
    });
  });

  describe("summarizeBatch", () => {
    it("processes multiple sessions successfully", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "session-1",
          userId: "user-1",
          agentId: "ux-analyst",
          createdAt: new Date(),
        },
      ]);
      mockFindUnique.mockResolvedValue({
        id: "session-1",
        agentId: "ux-analyst",
        messages: [{ role: "user", content: "Test", createdAt: new Date() }],
      });
      mockUpdate.mockResolvedValue({ id: "session-1", archived: true });

      const result = await summarizeBatch(10);

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("handles errors gracefully", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "session-1",
          userId: "user-1",
          title: "Session 1",
          createdAt: new Date(),
        },
      ]);
      mockFindUnique.mockResolvedValue(null); // Session not found during processing

      const result = await summarizeBatch(10);

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBeDefined();
    });
  });

  describe("loadSessionSummary", () => {
    it("returns null for non-archived session", async () => {
      mockFindUnique.mockResolvedValue({ archived: false, summaryUrl: null });

      const result = await loadSessionSummary("session-1");

      expect(result).toBeNull();
    });

    it("downloads and returns summary for archived session", async () => {
      mockFindUnique.mockResolvedValue({
        archived: true,
        summaryUrl: "gs://expert-ai-summaries/summaries/session-1.json",
      });

      const result = await loadSessionSummary("session-1");

      expect(result).toBe('{"summary":"test"}');
    });
  });
});
