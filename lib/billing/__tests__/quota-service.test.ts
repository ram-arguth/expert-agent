/**
 * Quota Service Tests
 *
 * Comprehensive tests for token quota checking and deduction.
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkQuota,
  deductTokens,
  getUsageSummary,
  isLowUsage,
  resetQuota,
  getPlanQuotas,
} from "../quota-service";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    org: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("Quota Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkQuota", () => {
    describe("org context", () => {
      it("returns allowed=true when org has tokens remaining", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue({
          id: "org-123",
          name: "Test Org",
          tokensRemaining: 5000,
          tokensMonthly: 10000,
          plan: "pro",
          quotaResetDate: new Date(),
        } as never);

        const result = await checkQuota("user-123", "org-123");

        expect(result.allowed).toBe(true);
        expect(result.tokensRemaining).toBe(5000);
        expect(result.tokensMonthly).toBe(10000);
        expect(result.usagePercent).toBe(50);
        expect(result.context).toBe("org");
      });

      it("returns allowed=false when org tokens exhausted", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue({
          id: "org-123",
          name: "Test Org",
          tokensRemaining: 0,
          tokensMonthly: 10000,
          plan: "free",
          quotaResetDate: new Date(),
        } as never);

        const result = await checkQuota("user-123", "org-123");

        expect(result.allowed).toBe(false);
        expect(result.tokensRemaining).toBe(0);
        expect(result.reason).toBe("Token quota exceeded");
        expect(result.upgradePrompt).toContain("Upgrade to Pro");
      });

      it("returns allowed=false when org not found", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue(null);

        const result = await checkQuota("user-123", "org-123");

        expect(result.allowed).toBe(false);
        expect(result.reason).toBe("Organization not found");
      });

      it("checks estimated tokens against remaining", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue({
          id: "org-123",
          name: "Test Org",
          tokensRemaining: 100,
          tokensMonthly: 10000,
          plan: "pro",
          quotaResetDate: new Date(),
        } as never);

        const result = await checkQuota("user-123", "org-123", 500);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Insufficient tokens");
      });

      it("calculates usage percent correctly", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue({
          id: "org-123",
          name: "Test Org",
          tokensRemaining: 2500,
          tokensMonthly: 10000,
          plan: "pro",
          quotaResetDate: new Date(),
        } as never);

        const result = await checkQuota("user-123", "org-123");

        expect(result.usagePercent).toBe(75); // 7500/10000 used
      });

      it("enterprise plan shows different upgrade prompt", async () => {
        vi.mocked(prisma.org.findUnique).mockResolvedValue({
          id: "org-123",
          name: "Test Org",
          tokensRemaining: 0,
          tokensMonthly: 500000,
          plan: "enterprise",
          quotaResetDate: new Date(),
        } as never);

        const result = await checkQuota("user-123", "org-123");

        expect(result.upgradePrompt).toContain("Contact sales");
      });
    });

    describe("personal context", () => {
      it("returns allowed=true for personal context", async () => {
        const result = await checkQuota("user-123", null);

        expect(result.allowed).toBe(true);
        expect(result.context).toBe("user");
        expect(result.tokensRemaining).toBeGreaterThan(0);
      });
    });
  });

  describe("deductTokens", () => {
    it("deducts tokens from org", async () => {
      vi.mocked(prisma.org.update).mockResolvedValue({
        tokensRemaining: 4500,
      } as never);

      const result = await deductTokens("user-123", "org-123", 500);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(4500);
      expect(prisma.org.update).toHaveBeenCalledWith({
        where: { id: "org-123" },
        data: { tokensRemaining: { decrement: 500 } },
        select: { tokensRemaining: true },
      });
    });

    it("handles deduction failure", async () => {
      vi.mocked(prisma.org.update).mockRejectedValue(new Error("DB error"));

      const result = await deductTokens("user-123", "org-123", 500);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });

    it("skips deduction for zero tokens", async () => {
      const result = await deductTokens("user-123", "org-123", 0);

      expect(result.success).toBe(true);
      expect(prisma.org.update).not.toHaveBeenCalled();
    });

    it("handles personal context", async () => {
      const result = await deductTokens("user-123", null, 500);

      expect(result.success).toBe(true);
      expect(prisma.org.update).not.toHaveBeenCalled();
    });

    it("clamps new balance to zero", async () => {
      vi.mocked(prisma.org.update).mockResolvedValue({
        tokensRemaining: -100,
      } as never);

      const result = await deductTokens("user-123", "org-123", 5000);

      expect(result.newBalance).toBe(0);
    });
  });

  describe("getUsageSummary", () => {
    it("returns org usage summary", async () => {
      const resetDate = new Date("2026-02-15");
      vi.mocked(prisma.org.findUnique).mockResolvedValue({
        tokensRemaining: 3000,
        tokensMonthly: 10000,
        quotaResetDate: resetDate,
        plan: "pro",
      } as never);

      const summary = await getUsageSummary("user-123", "org-123");

      expect(summary.tokensRemaining).toBe(3000);
      expect(summary.tokensMonthly).toBe(10000);
      expect(summary.usagePercent).toBe(70);
      expect(summary.quotaResetDate).toEqual(resetDate);
      expect(summary.plan).toBe("pro");
      expect(summary.isOrgContext).toBe(true);
    });

    it("returns default for missing org", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValue(null);

      const summary = await getUsageSummary("user-123", "org-123");

      expect(summary.tokensRemaining).toBe(0);
      expect(summary.usagePercent).toBe(100);
      expect(summary.plan).toBe("free");
    });

    it("returns personal context summary", async () => {
      const summary = await getUsageSummary("user-123", null);

      expect(summary.isOrgContext).toBe(false);
      expect(summary.plan).toBe("free");
      expect(summary.tokensRemaining).toBeGreaterThan(0);
    });
  });

  describe("isLowUsage", () => {
    it("returns true when usage is >= 90%", () => {
      expect(isLowUsage(90)).toBe(true);
      expect(isLowUsage(95)).toBe(true);
      expect(isLowUsage(100)).toBe(true);
    });

    it("returns false when usage is < 90%", () => {
      expect(isLowUsage(50)).toBe(false);
      expect(isLowUsage(89)).toBe(false);
      expect(isLowUsage(0)).toBe(false);
    });
  });

  describe("resetQuota", () => {
    it("resets quota for org with correct plan values", async () => {
      vi.mocked(prisma.org.update).mockResolvedValue({} as never);

      await resetQuota("org-123", "pro");

      expect(prisma.org.update).toHaveBeenCalledWith({
        where: { id: "org-123" },
        data: expect.objectContaining({
          tokensRemaining: 50000,
          tokensMonthly: 50000,
          plan: "pro",
        }),
      });
    });

    it("uses free quota for unknown plan", async () => {
      vi.mocked(prisma.org.update).mockResolvedValue({} as never);

      await resetQuota("org-123", "unknown");

      expect(prisma.org.update).toHaveBeenCalledWith({
        where: { id: "org-123" },
        data: expect.objectContaining({
          tokensRemaining: 1000,
          tokensMonthly: 1000,
        }),
      });
    });
  });

  describe("getPlanQuotas", () => {
    it("returns all plan quotas", () => {
      const quotas = getPlanQuotas();

      expect(quotas.free).toBe(1000);
      expect(quotas.pro).toBe(50000);
      expect(quotas.enterprise).toBe(500000);
    });

    it("returns a copy (not mutable)", () => {
      const quotas1 = getPlanQuotas();
      quotas1.free = 999;
      const quotas2 = getPlanQuotas();

      expect(quotas2.free).toBe(1000);
    });
  });
});
