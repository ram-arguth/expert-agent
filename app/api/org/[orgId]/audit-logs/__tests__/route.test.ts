/**
 * Audit Logs API Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.2
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
    },
  },
}));

// Mock cedar
vi.mock("@/lib/authz/cedar", () => ({
  isAuthorized: vi.fn(),
  CedarActions: {
    ViewAuditLog: "ViewAuditLog",
  },
}));

// Mock audit service
vi.mock("@/lib/audit/audit-service", () => ({
  getAuditLogs: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized } from "@/lib/authz/cedar";
import { getAuditLogs } from "@/lib/audit/audit-service";
import type { Mock } from "vitest";

const mockAuth = auth as Mock;
const mockFindUnique = prisma.membership.findUnique as Mock;
const mockIsAuthorized = isAuthorized as Mock;
const mockGetAuditLogs = getAuditLogs as Mock;

function createRequest(params: Record<string, string> = {}): NextRequest {
  const searchParams = new URLSearchParams(params);
  return new NextRequest(
    `http://localhost/api/org/org-123/audit-logs?${searchParams}`,
  );
}

describe("GET /api/org/:orgId/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated admin
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-123",
      role: "OWNER",
    });
    mockIsAuthorized.mockReturnValue({ isAuthorized: true });
    mockGetAuditLogs.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
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
      mockFindUnique.mockResolvedValue(null);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(403);
    });

    it("returns 403 for members without admin role", async () => {
      mockIsAuthorized.mockReturnValue({ isAuthorized: false });

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(403);
    });

    it("calls Cedar with ViewAuditLog action", async () => {
      await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(mockIsAuthorized).toHaveBeenCalledWith(
        expect.objectContaining({
          action: { type: "Action", id: "ViewAuditLog" },
        }),
      );
    });
  });

  describe("successful requests", () => {
    it("returns audit logs", async () => {
      const mockLogs = {
        logs: [{ id: "log-1", action: "LOGIN" }],
        total: 1,
        page: 1,
        pageSize: 50,
        hasMore: false,
      };
      mockGetAuditLogs.mockResolvedValue(mockLogs);

      const response = await GET(createRequest(), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.logs).toHaveLength(1);
    });

    it("passes page and pageSize params", async () => {
      await GET(createRequest({ page: "2", pageSize: "25" }), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(mockGetAuditLogs).toHaveBeenCalledWith(
        "org-123",
        expect.anything(),
        2,
        25,
      );
    });

    it("caps pageSize at 100", async () => {
      await GET(createRequest({ pageSize: "200" }), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(mockGetAuditLogs).toHaveBeenCalledWith(
        "org-123",
        expect.anything(),
        1,
        100,
      );
    });

    it("passes filter params", async () => {
      await GET(
        createRequest({
          userId: "user-1",
          action: "LOGIN",
          resourceType: "User",
        }),
        { params: Promise.resolve({ orgId: "org-123" }) },
      );

      expect(mockGetAuditLogs).toHaveBeenCalledWith(
        "org-123",
        expect.objectContaining({
          userId: "user-1",
          action: "LOGIN",
          resourceType: "User",
        }),
        1,
        50,
      );
    });
  });
});
