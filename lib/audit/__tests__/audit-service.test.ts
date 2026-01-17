/**
 * Audit Service Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.2
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logAuditEvent,
  getAuditLogs,
  extractRequestContext,
} from "../audit-service";
import type { AuditAction } from "@prisma/client";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import type { Mock } from "vitest";

const mockCreate = prisma.auditLog.create as Mock;
const mockFindMany = prisma.auditLog.findMany as Mock;
const mockCount = prisma.auditLog.count as Mock;

describe("Audit Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logAuditEvent", () => {
    it("creates audit log with required fields", async () => {
      const mockLog = {
        id: "log-1",
        orgId: "org-123",
        action: "LOGIN" as AuditAction,
        resourceType: "User",
        success: true,
        createdAt: new Date(),
      };
      mockCreate.mockResolvedValue(mockLog);

      const result = await logAuditEvent({
        orgId: "org-123",
        action: "LOGIN" as AuditAction,
        resourceType: "User",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: "org-123",
          action: "LOGIN",
          resourceType: "User",
          success: true,
        }),
      });
      expect(result).toEqual(mockLog);
    });

    it("includes optional fields when provided", async () => {
      mockCreate.mockResolvedValue({ id: "log-1" });

      await logAuditEvent({
        userId: "user-1",
        orgId: "org-123",
        action: "FILE_UPLOAD" as AuditAction,
        resourceType: "File",
        resourceId: "file-1",
        metadata: { filename: "test.pdf", size: 1024 },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          resourceId: "file-1",
          metadata: { filename: "test.pdf", size: 1024 },
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        }),
      });
    });

    it("logs failed events with error message", async () => {
      mockCreate.mockResolvedValue({ id: "log-1" });

      await logAuditEvent({
        orgId: "org-123",
        action: "LOGIN_FAILED" as AuditAction,
        resourceType: "User",
        success: false,
        errorMessage: "Invalid credentials",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          errorMessage: "Invalid credentials",
        }),
      });
    });
  });

  describe("getAuditLogs", () => {
    beforeEach(() => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
    });

    it("returns paginated results", async () => {
      const mockLogs = [{ id: "log-1" }, { id: "log-2" }];
      mockFindMany.mockResolvedValue(mockLogs);
      mockCount.mockResolvedValue(2);

      const result = await getAuditLogs("org-123");

      expect(result).toEqual({
        logs: mockLogs,
        total: 2,
        page: 1,
        pageSize: 50,
        hasMore: false,
      });
    });

    it("filters by userId", async () => {
      await getAuditLogs("org-123", { userId: "user-1" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: "org-123",
            userId: "user-1",
          }),
        }),
      );
    });

    it("filters by action", async () => {
      await getAuditLogs("org-123", { action: "LOGIN" as AuditAction });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: "LOGIN",
          }),
        }),
      );
    });

    it("filters by date range", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-01-31");

      await getAuditLogs("org-123", { startDate, endDate });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });

    it("calculates hasMore correctly", async () => {
      mockFindMany.mockResolvedValue(Array(50).fill({ id: "log" }));
      mockCount.mockResolvedValue(100);

      const result = await getAuditLogs("org-123", {}, 1, 50);

      expect(result.hasMore).toBe(true);
    });

    it("supports pagination", async () => {
      await getAuditLogs("org-123", {}, 2, 25);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
        }),
      );
    });
  });

  describe("extractRequestContext", () => {
    it("extracts IP from x-forwarded-for header", () => {
      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "192.168.1.1, 10.0.0.1",
          "user-agent": "Mozilla/5.0",
        },
      });

      const context = extractRequestContext(request);

      expect(context.ipAddress).toBe("192.168.1.1");
      expect(context.userAgent).toBe("Mozilla/5.0");
    });

    it("extracts IP from x-real-ip header", () => {
      const request = new Request("http://localhost", {
        headers: { "x-real-ip": "10.0.0.1" },
      });

      const context = extractRequestContext(request);

      expect(context.ipAddress).toBe("10.0.0.1");
    });

    it("returns null when no headers present", () => {
      const request = new Request("http://localhost");

      const context = extractRequestContext(request);

      expect(context.ipAddress).toBeNull();
      expect(context.userAgent).toBeNull();
    });
  });
});
