/**
 * Artifacts API Tests
 *
 * Unit tests for GET /api/artifacts endpoint
 *
 * @see app/api/artifacts/route.ts
 * @see docs/IMPEMENTATION.md - Phase 4.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock dependencies
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz/cedar", () => ({
  getCedarEngine: () => ({
    isAuthorized: vi.fn().mockReturnValue({ isAuthorized: true }),
  }),
  CedarActions: {
    ListArtifacts: "ListArtifacts",
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

describe("GET /api/artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 if not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/artifacts");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 if user ID is missing", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: "test@example.com" },
        expires: new Date().toISOString(),
      } as never);

      const request = new NextRequest("http://localhost/api/artifacts");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Successful Listing", () => {
    const mockSession = {
      user: { id: "user-123", email: "test@example.com" },
      expires: new Date().toISOString(),
    };

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
    });

    it("returns list of artifacts", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-123",
          agentId: "legal-advisor",
          createdAt: new Date("2026-01-10"),
          updatedAt: new Date("2026-01-15"),
          messages: [
            {
              id: "msg-1",
              content: "This is the analysis result...",
              jsonData: { title: "Contract Analysis" },
              createdAt: new Date(),
            },
          ],
          _count: { messages: 5 },
        },
        {
          id: "session-2",
          userId: "user-123",
          agentId: "ux-analyst",
          createdAt: new Date("2026-01-05"),
          updatedAt: new Date("2026-01-18"),
          messages: [
            {
              id: "msg-2",
              content: "Accessibility audit findings...",
              jsonData: { summary: "UX Audit Report" },
              createdAt: new Date(),
            },
          ],
          _count: { messages: 3 },
        },
      ];

      vi.mocked(prisma.session.findMany).mockResolvedValue(
        mockSessions as never,
      );

      const request = new NextRequest("http://localhost/api/artifacts");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.artifacts).toHaveLength(2);
      expect(data.artifacts[0].title).toBe("Contract Analysis");
      expect(data.artifacts[0].agentName).toBe("Legal Advisor");
      expect(data.artifacts[1].title).toBe("UX Audit Report");
    });

    it("returns empty array if no artifacts", async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/artifacts");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.artifacts).toEqual([]);
      expect(data.pagination.count).toBe(0);
    });

    it("generates title from agent name if no JSON title", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-123",
          agentId: "ux-analyst",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [
            {
              id: "msg-1",
              content: "Some analysis content...",
              jsonData: null,
              createdAt: new Date(),
            },
          ],
          _count: { messages: 1 },
        },
      ];

      vi.mocked(prisma.session.findMany).mockResolvedValue(
        mockSessions as never,
      );

      const request = new NextRequest("http://localhost/api/artifacts");
      const response = await GET(request);

      const data = await response.json();
      expect(data.artifacts[0].title).toBe("UX Analyst Analysis");
    });
  });

  describe("Filtering", () => {
    const mockSession = {
      user: { id: "user-123", email: "test@example.com" },
      expires: new Date().toISOString(),
    };

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
    });

    it("filters by agentId", async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost/api/artifacts?agentId=legal-advisor",
      );
      await GET(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentId: "legal-advisor",
          }),
        }),
      );
    });

    it("returns message for favorites filter (not implemented)", async () => {
      const request = new NextRequest(
        "http://localhost/api/artifacts?filter=favorites",
      );
      const response = await GET(request);

      const data = await response.json();
      expect(data.filter).toBe("favorites");
      expect(data.artifacts).toEqual([]);
      expect(data.message.toLowerCase()).toContain("coming soon");
    });

    it("returns message for shared filter (not implemented)", async () => {
      const request = new NextRequest(
        "http://localhost/api/artifacts?filter=shared",
      );
      const response = await GET(request);

      const data = await response.json();
      expect(data.filter).toBe("shared");
      expect(data.artifacts).toEqual([]);
      expect(data.message.toLowerCase()).toContain("coming soon");
    });
  });

  describe("Pagination", () => {
    const mockSession = {
      user: { id: "user-123", email: "test@example.com" },
      expires: new Date().toISOString(),
    };

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
    });

    it("respects limit parameter", async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/artifacts?limit=5");
      await GET(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 6, // limit + 1 to check for more
        }),
      );
    });

    it("uses cursor for pagination", async () => {
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const cursorId = "550e8400-e29b-41d4-a716-446655440000";
      const request = new NextRequest(
        `http://localhost/api/artifacts?cursor=${cursorId}`,
      );
      await GET(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { lt: cursorId },
          }),
        }),
      );
    });

    it("indicates hasMore when more results exist", async () => {
      // Return limit + 1 sessions to indicate more exist
      const sessions = Array(21)
        .fill(null)
        .map((_, i) => ({
          id: `session-${i}`,
          userId: "user-123",
          agentId: "legal-advisor",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [
            {
              id: `msg-${i}`,
              content: "Content...",
              jsonData: { title: `Artifact ${i}` },
              createdAt: new Date(),
            },
          ],
          _count: { messages: 1 },
        }));

      vi.mocked(prisma.session.findMany).mockResolvedValue(sessions as never);

      const request = new NextRequest(
        "http://localhost/api/artifacts?limit=20",
      );
      const response = await GET(request);

      const data = await response.json();
      expect(data.pagination.hasMore).toBe(true);
      expect(data.pagination.nextCursor).toBe("session-19");
      expect(data.artifacts).toHaveLength(20);
    });
  });

  describe("Query Validation", () => {
    const mockSession = {
      user: { id: "user-123", email: "test@example.com" },
      expires: new Date().toISOString(),
    };

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(mockSession as never);
    });

    it("rejects invalid filter value", async () => {
      const request = new NextRequest(
        "http://localhost/api/artifacts?filter=invalid",
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Validation Error");
    });

    it("rejects invalid cursor format", async () => {
      const request = new NextRequest(
        "http://localhost/api/artifacts?cursor=not-a-uuid",
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it("rejects limit over 100", async () => {
      const request = new NextRequest(
        "http://localhost/api/artifacts?limit=200",
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe("Security", () => {
    it("only returns artifacts for authenticated user", async () => {
      const mockSession = {
        user: { id: "user-123", email: "test@example.com" },
        expires: new Date().toISOString(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/artifacts");
      await GET(request);

      // Verify query filters by user ID
      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-123",
          }),
        }),
      );
    });

    it("excludes archived sessions", async () => {
      const mockSession = {
        user: { id: "user-123", email: "test@example.com" },
        expires: new Date().toISOString(),
      };
      vi.mocked(auth).mockResolvedValue(mockSession as never);
      vi.mocked(prisma.session.findMany).mockResolvedValue([]);

      const request = new NextRequest("http://localhost/api/artifacts");
      await GET(request);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            archived: false,
          }),
        }),
      );
    });
  });
});
