/**
 * Token Deduction Tests
 *
 * Tests for deductTokens function from quota-service.ts
 * Covers atomic deduction, org/user balance, and edge cases.
 *
 * @see docs/IMPEMENTATION.md - Phase 3.6 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deductTokens } from "../quota-service";
import { prisma } from "@/lib/db";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    org: {
      update: vi.fn(),
    },
  },
}));

describe("Token Deduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Org Context", () => {
    it("deducts exact tokens used from org balance", async () => {
      vi.mocked(prisma.org.update).mockResolvedValueOnce({
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        type: "TEAM",
        domain: null,
        domainVerified: false,
        verificationToken: null,
        ssoConfig: null,
        stripeCustomerId: null,
        plan: "pro",
        tokensRemaining: 49500, // 50000 - 500 = 49500
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await deductTokens("user-123", "org-123", 500);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(49500);
      expect(prisma.org.update).toHaveBeenCalledWith({
        where: { id: "org-123" },
        data: {
          tokensRemaining: {
            decrement: 500,
          },
        },
        select: {
          tokensRemaining: true,
        },
      });
    });

    it("updates org balance atomically using decrement", async () => {
      vi.mocked(prisma.org.update).mockResolvedValueOnce({
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        type: "TEAM",
        domain: null,
        domainVerified: false,
        verificationToken: null,
        ssoConfig: null,
        stripeCustomerId: null,
        plan: "pro",
        tokensRemaining: 250,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await deductTokens("user-123", "org-123", 250);

      // Verify atomic decrement is used (not read-modify-write)
      const updateCall = vi.mocked(prisma.org.update).mock.calls[0][0];
      expect(updateCall.data.tokensRemaining).toEqual({ decrement: 250 });
    });

    it("handles negative balance gracefully with floor at 0", async () => {
      // Simulate a race condition where balance goes negative
      vi.mocked(prisma.org.update).mockResolvedValueOnce({
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        type: "TEAM",
        domain: null,
        domainVerified: false,
        verificationToken: null,
        ssoConfig: null,
        stripeCustomerId: null,
        plan: "free",
        tokensRemaining: -50, // Negative due to race condition
        tokensMonthly: 1000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await deductTokens("user-123", "org-123", 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0); // Floored at 0
    });

    it("handles database error during deduction", async () => {
      vi.mocked(prisma.org.update).mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const result = await deductTokens("user-123", "org-123", 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
      expect(result.newBalance).toBe(0);
    });

    it("succeeds with zero tokens to deduct", async () => {
      // Should not call database for 0 token deduction
      const result = await deductTokens("user-123", "org-123", 0);

      expect(result.success).toBe(true);
      expect(prisma.org.update).not.toHaveBeenCalled();
    });

    it("succeeds with negative tokens to deduct (no-op)", async () => {
      // Negative tokens should be treated as no-op
      const result = await deductTokens("user-123", "org-123", -50);

      expect(result.success).toBe(true);
      expect(prisma.org.update).not.toHaveBeenCalled();
    });
  });

  describe("Personal Context (no org)", () => {
    it("returns success without database call for personal context", async () => {
      const result = await deductTokens("user-123", null, 100);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(1000); // Free tier quota
      expect(prisma.org.update).not.toHaveBeenCalled();
    });

    it("handles personal context with large token deduction", async () => {
      // Personal context doesn't currently track tokens individually
      // so any deduction should succeed
      const result = await deductTokens("user-123", null, 10000);

      expect(result.success).toBe(true);
      expect(prisma.org.update).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles very large token deductions", async () => {
      vi.mocked(prisma.org.update).mockResolvedValueOnce({
        id: "org-123",
        name: "Test Org",
        slug: "test-org",
        type: "ENTERPRISE",
        domain: null,
        domainVerified: false,
        verificationToken: null,
        ssoConfig: null,
        stripeCustomerId: null,
        plan: "enterprise",
        tokensRemaining: 400000, // 500000 - 100000
        tokensMonthly: 500000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await deductTokens("user-123", "org-123", 100000);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(400000);
    });

    it("handles non-Error exception during deduction", async () => {
      vi.mocked(prisma.org.update).mockRejectedValueOnce("string error");

      const result = await deductTokens("user-123", "org-123", 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Token deduction failed");
    });
  });
});
