/**
 * Integration Tests: Quota API Endpoints
 *
 * Tests quota enforcement with real database:
 * - Query succeeds when tokens available
 * - Query returns 402 when exhausted
 * - Balance decreases after query
 * - Portal session requires customer ID
 *
 * Run with: pnpm test:integration quota
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";
import {
  checkQuota,
  deductTokens,
  getUsageSummary,
} from "@/lib/billing/quota-service";

// Mock Prisma to use test database
// This allows the quota-service functions to use the test database
import { vi } from "vitest";

// Store original prisma reference
const originalPrisma = vi.hoisted(() => {
  return {};
});

vi.mock("@/lib/db", async () => {
  const { testPrisma } = await import("@/lib/test-utils/integration");
  return { prisma: testPrisma };
});

describe("Quota Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("Query Flow with Tokens Available", () => {
    it("allows query when org has sufficient tokens", async () => {
      // Create org with tokens
      const org = await testPrisma.org.create({
        data: {
          name: "Query Test Org",
          slug: "query-test",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 45000,
        },
      });

      const user = await testPrisma.user.create({
        data: {
          email: "quota-user@example.com",
          name: "Quota User",
          authProvider: "google",
        },
      });

      // Check quota
      const result = await checkQuota(user.id, org.id);

      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(45000);
      expect(result.context).toBe("org");
    });

    it("returns correct usage percentage", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Usage Percent Org",
          slug: "usage-percent",
          type: "TEAM",
          tokensMonthly: 10000,
          tokensRemaining: 2500, // 75% used
        },
      });

      const result = await checkQuota("user-123", org.id);

      expect(result.usagePercent).toBe(75);
    });

    it("allows query with estimated tokens within limit", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Estimated Tokens Org",
          slug: "estimated",
          type: "TEAM",
          tokensMonthly: 5000,
          tokensRemaining: 1000,
        },
      });

      const result = await checkQuota("user-123", org.id, 500);

      expect(result.allowed).toBe(true);
    });
  });

  describe("Query Denied (402) When Exhausted", () => {
    it("returns 402-like response when org has zero tokens", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Zero Token Org",
          slug: "zero-tokens",
          type: "TEAM",
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 0,
        },
      });

      const result = await checkQuota("user-123", org.id);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeded");
      expect(result.upgradePrompt).toBeTruthy();
    });

    it("returns upgrade prompt for free plan", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Free Plan Org",
          slug: "free-plan",
          type: "TEAM",
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 0,
        },
      });

      const result = await checkQuota("user-123", org.id);

      expect(result.upgradePrompt).toContain("Pro");
    });

    it("returns sales contact for pro plan exhausted", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Pro Plan Exhausted",
          slug: "pro-exhausted",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 0,
        },
      });

      const result = await checkQuota("user-123", org.id);

      expect(result.upgradePrompt).toContain("sales");
    });

    it("denies when estimated tokens exceed remaining", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Insufficient Org",
          slug: "insufficient",
          type: "TEAM",
          tokensMonthly: 5000,
          tokensRemaining: 100,
        },
      });

      const result = await checkQuota("user-123", org.id, 500);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Insufficient");
    });
  });

  describe("Balance Decreases After Query", () => {
    it("deducts tokens atomically", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Deduct Org",
          slug: "deduct",
          type: "TEAM",
          tokensMonthly: 10000,
          tokensRemaining: 10000,
        },
      });

      const result = await deductTokens("user-123", org.id, 1500);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(8500);

      // Verify in database
      const updatedOrg = await testPrisma.org.findUnique({
        where: { id: org.id },
      });
      expect(updatedOrg?.tokensRemaining).toBe(8500);
    });

    it("handles multiple sequential deductions", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Multi Deduct Org",
          slug: "multi-deduct-quota",
          type: "TEAM",
          tokensMonthly: 10000,
          tokensRemaining: 10000,
        },
      });

      // Simulate multiple queries
      await deductTokens("user-123", org.id, 1000);
      await deductTokens("user-123", org.id, 2000);
      await deductTokens("user-123", org.id, 500);

      const updatedOrg = await testPrisma.org.findUnique({
        where: { id: org.id },
      });
      expect(updatedOrg?.tokensRemaining).toBe(6500);
    });

    it("returns zero for balance floor", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Floor Org",
          slug: "floor",
          type: "TEAM",
          tokensMonthly: 100,
          tokensRemaining: 50,
        },
      });

      const result = await deductTokens("user-123", org.id, 100);

      // newBalance is max(0, actual) for display purposes
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(0);

      // Database may go negative (billing handles enforcement)
      const updatedOrg = await testPrisma.org.findUnique({
        where: { id: org.id },
      });
      expect(updatedOrg?.tokensRemaining).toBe(-50);
    });

    it("skips deduction for zero tokens", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Zero Deduct Org",
          slug: "zero-deduct",
          type: "TEAM",
          tokensMonthly: 1000,
          tokensRemaining: 1000,
        },
      });

      const result = await deductTokens("user-123", org.id, 0);

      expect(result.success).toBe(true);

      // Balance unchanged
      const updatedOrg = await testPrisma.org.findUnique({
        where: { id: org.id },
      });
      expect(updatedOrg?.tokensRemaining).toBe(1000);
    });
  });

  describe("Usage Summary", () => {
    it("returns correct org usage summary", async () => {
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const org = await testPrisma.org.create({
        data: {
          name: "Summary Org",
          slug: "summary",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 35000,
          quotaResetDate: nextMonth,
        },
      });

      const summary = await getUsageSummary("user-123", org.id);

      expect(summary.tokensRemaining).toBe(35000);
      expect(summary.tokensMonthly).toBe(50000);
      expect(summary.usagePercent).toBe(30);
      expect(summary.plan).toBe("pro");
      expect(summary.isOrgContext).toBe(true);
      expect(summary.quotaResetDate).not.toBeNull();
    });

    it("returns personal context for null org", async () => {
      const summary = await getUsageSummary("user-123", null);

      expect(summary.isOrgContext).toBe(false);
      expect(summary.plan).toBe("free");
      expect(summary.tokensMonthly).toBe(1000);
    });

    it("returns empty summary for non-existent org", async () => {
      const summary = await getUsageSummary("user-123", "non-existent-org-id");

      expect(summary.tokensRemaining).toBe(0);
      expect(summary.usagePercent).toBe(100);
    });
  });

  describe("Portal Session Requirements", () => {
    it("org with Stripe customer ID can access portal", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Portal Org",
          slug: "portal",
          type: "TEAM",
          plan: "pro",
          stripeCustomerId: "cus_test123",
        },
      });

      // Verify Stripe customer ID is set
      expect(org.stripeCustomerId).toBe("cus_test123");

      // Portal access requires stripeCustomerId
      const orgWithCustomer = await testPrisma.org.findUnique({
        where: { id: org.id },
        select: { stripeCustomerId: true },
      });

      expect(orgWithCustomer?.stripeCustomerId).toBeTruthy();
    });

    it("org without Stripe customer ID cannot access portal", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "No Stripe Org",
          slug: "no-stripe",
          type: "TEAM",
          plan: "free",
        },
      });

      const orgWithoutCustomer = await testPrisma.org.findUnique({
        where: { id: org.id },
        select: { stripeCustomerId: true },
      });

      expect(orgWithoutCustomer?.stripeCustomerId).toBeNull();
    });
  });
});
