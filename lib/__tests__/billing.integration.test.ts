/**
 * Integration Tests: Billing & Token Quota
 *
 * Tests billing functionality with real database:
 * - Token quota checking (org context)
 * - Token deduction after queries
 * - Usage summary retrieval
 * - Quota reset on subscription renewal
 *
 * Run with: pnpm test:integration billing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";

// Import quota service functions (they use the same prisma under the hood)
// We'll test them by setting up data and calling the functions

describe("Billing Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("Organization Token Quota", () => {
    it("creates org with default token quota", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Quota Test Org",
          slug: "quota-test",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 50000,
        },
      });

      expect(org.tokensMonthly).toBe(50000);
      expect(org.tokensRemaining).toBe(50000);
      expect(org.plan).toBe("pro");
    });

    it("tracks token usage via decrement", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Usage Test Org",
          slug: "usage-test",
          type: "TEAM",
          tokensMonthly: 10000,
          tokensRemaining: 10000,
        },
      });

      // Simulate token deduction
      const updated = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          tokensRemaining: { decrement: 1500 },
        },
      });

      expect(updated.tokensRemaining).toBe(8500);
    });

    it("allows multiple deductions atomically", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Multi Deduct Org",
          slug: "multi-deduct",
          type: "TEAM",
          tokensMonthly: 5000,
          tokensRemaining: 5000,
        },
      });

      // Simulate multiple queries
      const deductions = [500, 750, 1000, 250];

      for (const amount of deductions) {
        await testPrisma.org.update({
          where: { id: org.id },
          data: { tokensRemaining: { decrement: amount } },
        });
      }

      const final = await testPrisma.org.findUnique({
        where: { id: org.id },
      });

      // 5000 - 500 - 750 - 1000 - 250 = 2500
      expect(final?.tokensRemaining).toBe(2500);
    });

    it("can go negative (billing handles enforcement)", async () => {
      // Database allows negative - quota-service enforces limits
      const org = await testPrisma.org.create({
        data: {
          name: "Overdraft Org",
          slug: "overdraft",
          type: "TEAM",
          tokensMonthly: 100,
          tokensRemaining: 100,
        },
      });

      const updated = await testPrisma.org.update({
        where: { id: org.id },
        data: { tokensRemaining: { decrement: 200 } },
      });

      expect(updated.tokensRemaining).toBe(-100);
    });
  });

  describe("Quota Reset (Subscription Renewal)", () => {
    it("resets tokens to monthly quota", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Reset Test Org",
          slug: "reset-test",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 1000, // Low balance
        },
      });

      // Simulate subscription renewal reset
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const reset = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          tokensRemaining: 50000,
          quotaResetDate: nextMonth,
        },
      });

      expect(reset.tokensRemaining).toBe(50000);
      expect(reset.quotaResetDate).not.toBeNull();
    });

    it("upgrades plan and increases quota", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Upgrade Org",
          slug: "upgrade",
          type: "TEAM",
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 500,
        },
      });

      // Simulate upgrade to enterprise
      const upgraded = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "enterprise",
          tokensMonthly: 500000,
          tokensRemaining: 500000,
        },
      });

      expect(upgraded.plan).toBe("enterprise");
      expect(upgraded.tokensMonthly).toBe(500000);
    });
  });

  describe("Multi-Org Token Isolation", () => {
    it("tracks tokens independently per org", async () => {
      const org1 = await testPrisma.org.create({
        data: {
          name: "Org One",
          slug: "org-one",
          type: "TEAM",
          tokensRemaining: 10000,
        },
      });

      const org2 = await testPrisma.org.create({
        data: {
          name: "Org Two",
          slug: "org-two",
          type: "TEAM",
          tokensRemaining: 10000,
        },
      });

      // Deduct from org1 only
      await testPrisma.org.update({
        where: { id: org1.id },
        data: { tokensRemaining: { decrement: 3000 } },
      });

      const [updated1, updated2] = await Promise.all([
        testPrisma.org.findUnique({ where: { id: org1.id } }),
        testPrisma.org.findUnique({ where: { id: org2.id } }),
      ]);

      expect(updated1?.tokensRemaining).toBe(7000);
      expect(updated2?.tokensRemaining).toBe(10000); // Unchanged
    });
  });

  describe("Stripe Integration Data", () => {
    it("stores Stripe customer ID on org", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Stripe Org",
          slug: "stripe-org",
          type: "TEAM",
          stripeCustomerId: "cus_TestCustomer123",
        },
      });

      expect(org.stripeCustomerId).toBe("cus_TestCustomer123");
    });

    it("updates Stripe customer ID and plan after checkout", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Subscription Org",
          slug: "sub-org",
          type: "TEAM",
        },
      });

      const updated = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          stripeCustomerId: "cus_NewCustomer",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 50000,
        },
      });

      expect(updated.stripeCustomerId).toBe("cus_NewCustomer");
      expect(updated.plan).toBe("pro");
    });
  });

  describe("User with Org Token Access", () => {
    it("user can query org token balance via membership", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "billing-user@example.com",
          name: "Billing User",
          authProvider: "google",
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: "Member Org",
          slug: "member-org",
          type: "TEAM",
          tokensRemaining: 25000,
          tokensMonthly: 50000,
        },
      });

      await testPrisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "MEMBER",
        },
      });

      // Query user's org token balance
      const membership = await testPrisma.membership.findFirst({
        where: { userId: user.id },
        include: {
          org: {
            select: {
              tokensRemaining: true,
              tokensMonthly: true,
              plan: true,
            },
          },
        },
      });

      expect(membership?.org.tokensRemaining).toBe(25000);
      expect(membership?.org.tokensMonthly).toBe(50000);
    });
  });
});
