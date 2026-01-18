/**
 * Quota Check Tests
 *
 * Tests for checkQuota function from quota-service.ts
 * Covers user/org context, quota exhaustion, and upgrade prompts.
 *
 * @see docs/IMPEMENTATION.md - Phase 5.5 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkQuota } from "../quota-service";
import { prisma } from "@/lib/db";

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    org: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Quota Check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Personal Context (no org)", () => {
    it("returns allowed when in personal context", async () => {
      const result = await checkQuota("user-123", null);

      expect(result.allowed).toBe(true);
      expect(result.context).toBe("user");
      expect(result.tokensRemaining).toBeGreaterThan(0);
    });

    it("returns free tier quota for personal users", async () => {
      const result = await checkQuota("user-123", null);

      expect(result.tokensMonthly).toBe(1000); // Free tier
      expect(result.usagePercent).toBe(0); // No usage tracked for personal yet
    });
  });

  describe("Org Context", () => {
    it("returns allowed when org has tokens remaining", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 45000,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.allowed).toBe(true);
      expect(result.context).toBe("org");
      expect(result.tokensRemaining).toBe(45000);
      expect(result.tokensMonthly).toBe(50000);
    });

    it("returns not allowed when org has zero tokens", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 0,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeded");
    });

    it("returns not allowed when org has negative tokens", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: -50,
        tokensMonthly: 1000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.allowed).toBe(false);
    });

    it("calculates usage percentage correctly", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 25000, // 50% remaining = 50% used
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.usagePercent).toBe(50);
    });

    it("returns upgrade prompt for free plan when exhausted", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 0,
        tokensMonthly: 1000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.allowed).toBe(false);
      expect(result.upgradePrompt).toContain("Pro");
    });

    it("returns contact sales prompt for pro plan when exhausted", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 0,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123");

      expect(result.upgradePrompt).toContain("sales");
    });

    it("returns not found error for missing org", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce(null);

      const result = await checkQuota("user-123", "non-existent-org");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });
  });

  describe("Estimated Token Pre-Check", () => {
    it("allows query when estimated tokens within remaining", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 1000,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123", 500);

      expect(result.allowed).toBe(true);
    });

    it("denies query when estimated tokens exceed remaining", async () => {
      vi.mocked(prisma.org.findUnique).mockResolvedValueOnce({
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
        tokensRemaining: 100,
        tokensMonthly: 50000,
        quotaResetDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkQuota("user-123", "org-123", 500);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Insufficient");
    });
  });
});
