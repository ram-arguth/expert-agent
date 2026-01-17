/**
 * Usage Analytics API Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    usageRecord: {
      groupBy: vi.fn(),
    },
  },
}));

// Mock cedar
vi.mock("@/lib/authz/cedar", () => ({
  isAuthorized: vi.fn(),
  CedarActions: {
    ViewUsage: "ViewUsage",
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized } from "@/lib/authz/cedar";
import type { Mock } from "vitest";

const mockAuth = auth as Mock;
const mockFindUniqueMembership = prisma.membership.findUnique as Mock;
const mockFindManyMembership = prisma.membership.findMany as Mock;
const mockGroupBy = prisma.usageRecord.groupBy as Mock;
const mockIsAuthorized = isAuthorized as Mock;

function createRequest(days?: string): NextRequest {
  const url = days
    ? `http://localhost/api/org/org-123/usage?days=${days}`
    : "http://localhost/api/org/org-123/usage";
  return new NextRequest(url);
}

describe("GET /api/org/:orgId/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated admin
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindUniqueMembership.mockResolvedValue({
      userId: "user-1",
      orgId: "org-123",
      role: "OWNER",
    });
    mockIsAuthorized.mockReturnValue({ isAuthorized: true });

    // Default members
    mockFindManyMembership.mockResolvedValue([
      {
        userId: "user-1",
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
      },
      {
        userId: "user-2",
        user: { id: "user-2", name: "Bob", email: "bob@example.com" },
      },
    ]);
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("authorization", () => {
    it("returns 403 for non-members", async () => {
      mockFindUniqueMembership.mockResolvedValue(null);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toMatch(/not a member/i);
    });

    it("returns 403 for members without admin role", async () => {
      mockFindUniqueMembership.mockResolvedValue({
        userId: "user-1",
        orgId: "org-123",
        role: "MEMBER",
      });
      mockIsAuthorized.mockReturnValue({ isAuthorized: false });

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(403);
    });

    it("calls Cedar with correct principal and action", async () => {
      mockGroupBy.mockResolvedValue([]);

      await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(mockIsAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({
          principal: expect.objectContaining({
            type: "User",
            id: "user-1",
          }),
          action: { type: "Action", id: "ViewUsage" },
          resource: { type: "Org", id: "org-123" },
        }),
      );
    });
  });

  describe("usage aggregation", () => {
    it("returns usage by user", async () => {
      mockGroupBy
        .mockResolvedValueOnce([
          {
            userId: "user-1",
            _sum: { inputTokens: 500, outputTokens: 1500 },
            _count: { id: 5 },
          },
          {
            userId: "user-2",
            _sum: { inputTokens: 200, outputTokens: 800 },
            _count: { id: 3 },
          },
        ])
        .mockResolvedValueOnce([]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.byUser).toHaveLength(2);
      expect(data.byUser[0]).toMatchObject({
        userId: "user-1",
        userName: "Alice",
        tokensUsed: 2000,
        queryCount: 5,
      });
    });

    it("returns usage by agent", async () => {
      mockGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          agentId: "ux-analyst",
          _sum: { inputTokens: 1000, outputTokens: 3000 },
          _count: { id: 10 },
        },
        {
          agentId: "legal-advisor",
          _sum: { inputTokens: 500, outputTokens: 1500 },
          _count: { id: 5 },
        },
      ]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.byAgent).toHaveLength(2);
      expect(data.byAgent[0]).toMatchObject({
        agentId: "ux-analyst",
        agentName: "Ux Analyst",
        tokensUsed: 4000,
      });
    });

    it("calculates correct totals", async () => {
      mockGroupBy
        .mockResolvedValueOnce([
          {
            userId: "user-1",
            _sum: { inputTokens: 500, outputTokens: 1500 },
            _count: { id: 5 },
          },
        ])
        .mockResolvedValueOnce([]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      expect(data.totals).toEqual({
        tokensUsed: 2000,
        queryCount: 5,
      });
    });

    it("calculates percentage of total", async () => {
      mockGroupBy
        .mockResolvedValueOnce([
          {
            userId: "user-1",
            _sum: { inputTokens: 400, outputTokens: 600 },
            _count: { id: 5 },
          },
          {
            userId: "user-2",
            _sum: { inputTokens: 600, outputTokens: 400 },
            _count: { id: 5 },
          },
        ])
        .mockResolvedValueOnce([]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      // Both used 1000 tokens each = 50% each
      expect(data.byUser[0].percentage).toBe(50);
      expect(data.byUser[1].percentage).toBe(50);
    });
  });

  describe("date range", () => {
    it("uses default 30 day range", async () => {
      mockGroupBy.mockResolvedValue([]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      expect(data.period.days).toBe(30);
    });

    it("accepts custom days parameter", async () => {
      mockGroupBy.mockResolvedValue([]);

      const response = await GET(createRequest("7"), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      expect(data.period.days).toBe(7);
    });

    it("clamps days to valid range", async () => {
      mockGroupBy.mockResolvedValue([]);

      const response = await GET(createRequest("500"), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      expect(data.period.days).toBe(365); // Max
    });
  });

  describe("empty state", () => {
    it("handles no usage data", async () => {
      mockGroupBy.mockResolvedValue([]);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });
      const data = await response.json();

      expect(data.byUser).toEqual([]);
      expect(data.byAgent).toEqual([]);
      expect(data.totals.tokensUsed).toBe(0);
    });
  });
});
