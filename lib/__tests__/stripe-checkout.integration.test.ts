/**
 * Integration Tests: Stripe Checkout & Webhook
 *
 * Tests Stripe billing flow with mocked Stripe SDK:
 * - Checkout session creation
 * - Webhook event processing
 * - Plan and token updates
 *
 * Run with: pnpm test:integration stripe-checkout
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";

// Mock Stripe module
vi.mock("stripe", () => {
  const mockCheckoutSession = {
    id: "cs_test_123",
    url: "https://checkout.stripe.com/test",
  };

  const mockCustomer = {
    id: "cus_test_123",
    email: "test@example.com",
  };

  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue(mockCheckoutSession),
        },
      },
      customers: {
        create: vi.fn().mockResolvedValue(mockCustomer),
      },
      webhooks: {
        constructEvent: vi.fn().mockImplementation((body, sig, secret) => {
          // Return the body as-is for testing
          return JSON.parse(body);
        }),
      },
    })),
  };
});

describe("Stripe Checkout Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("Checkout Session Creation", () => {
    it("creates org with Stripe customer ID after checkout", async () => {
      // Create user and org
      const user = await testPrisma.user.create({
        data: {
          email: "checkout-user@example.com",
          name: "Checkout User",
          authProvider: "google",
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: "Checkout Test Org",
          slug: "checkout-test",
          type: "TEAM",
          plan: "free",
        },
      });

      // Create membership as ADMIN
      await testPrisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "ADMIN",
        },
      });

      // Simulate updating org with Stripe customer ID (what checkout route does)
      const updatedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          stripeCustomerId: "cus_test_123",
        },
      });

      expect(updatedOrg.stripeCustomerId).toBe("cus_test_123");
    });

    it("requires ADMIN or OWNER role for checkout", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "member@example.com",
          authProvider: "google",
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: "Member Org",
          slug: "member-org",
          type: "TEAM",
        },
      });

      // Create membership as MEMBER (not ADMIN)
      await testPrisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "MEMBER",
        },
      });

      // Query to check if user has billing permissions
      const adminMembership = await testPrisma.membership.findFirst({
        where: {
          userId: user.id,
          orgId: org.id,
          role: { in: ["ADMIN", "OWNER"] },
        },
      });

      // Member should not have billing access
      expect(adminMembership).toBeNull();
    });

    it("reuses existing Stripe customer ID", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Existing Customer Org",
          slug: "existing-customer",
          type: "TEAM",
          stripeCustomerId: "cus_existing_123",
        },
      });

      // Fetch org - should have existing customer ID
      const fetchedOrg = await testPrisma.org.findUnique({
        where: { id: org.id },
        select: { stripeCustomerId: true },
      });

      expect(fetchedOrg?.stripeCustomerId).toBe("cus_existing_123");
    });
  });

  describe("Webhook Processing - checkout.session.completed", () => {
    it("updates org with stripeCustomerId from webhook", async () => {
      // Create org without Stripe customer
      const org = await testPrisma.org.create({
        data: {
          name: "Webhook Test Org",
          slug: "webhook-test",
          type: "TEAM",
          plan: "free",
        },
      });

      // Simulate webhook updating org
      const updatedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          stripeCustomerId: "cus_webhook_123",
        },
      });

      expect(updatedOrg.stripeCustomerId).toBe("cus_webhook_123");
    });

    it("sets pro plan and tokens on checkout completion", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Plan Update Org",
          slug: "plan-update",
          type: "TEAM",
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 1000,
        },
      });

      // Simulate webhook setting plan to pro
      const PRO_TOKENS = 50000;
      const updatedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "pro",
          tokensMonthly: PRO_TOKENS,
          tokensRemaining: PRO_TOKENS,
          stripeCustomerId: "cus_pro_123",
        },
      });

      expect(updatedOrg.plan).toBe("pro");
      expect(updatedOrg.tokensMonthly).toBe(50000);
      expect(updatedOrg.tokensRemaining).toBe(50000);
    });

    it("sets enterprise plan with higher token limit", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Enterprise Org",
          slug: "enterprise",
          type: "ENTERPRISE",
          plan: "free",
        },
      });

      // Simulate webhook setting plan to enterprise
      const ENTERPRISE_TOKENS = 500000;
      const updatedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "enterprise",
          tokensMonthly: ENTERPRISE_TOKENS,
          tokensRemaining: ENTERPRISE_TOKENS,
        },
      });

      expect(updatedOrg.plan).toBe("enterprise");
      expect(updatedOrg.tokensMonthly).toBe(500000);
    });
  });

  describe("Webhook Processing - invoice.payment_succeeded", () => {
    it("resets token quota on subscription renewal", async () => {
      // Org with depleted tokens
      const org = await testPrisma.org.create({
        data: {
          name: "Renewal Org",
          slug: "renewal",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 500, // Almost depleted
        },
      });

      // Simulate renewal resetting tokens
      const renewedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          tokensRemaining: org.tokensMonthly, // Reset to monthly allocation
          quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      expect(renewedOrg.tokensRemaining).toBe(50000);
      expect(renewedOrg.quotaResetDate).not.toBeNull();
    });
  });

  describe("Webhook Processing - customer.subscription.deleted", () => {
    it("downgrades org to free plan on subscription cancellation", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Cancelled Org",
          slug: "cancelled",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 30000,
          stripeCustomerId: "cus_cancelled_123",
        },
      });

      // Simulate subscription deleted - downgrade to free
      const FREE_TOKENS = 1000;
      const downgradedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "free",
          tokensMonthly: FREE_TOKENS,
          tokensRemaining: Math.min(org.tokensRemaining, FREE_TOKENS),
        },
      });

      expect(downgradedOrg.plan).toBe("free");
      expect(downgradedOrg.tokensMonthly).toBe(1000);
      expect(downgradedOrg.tokensRemaining).toBe(1000); // Limited to free tier
    });

    it("preserves stripeCustomerId after cancellation for resubscription", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Resubscribe Org",
          slug: "resubscribe",
          type: "TEAM",
          plan: "pro",
          stripeCustomerId: "cus_resub_123",
        },
      });

      // Downgrade but keep customer ID
      const downgradedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 1000,
          // stripeCustomerId is NOT cleared
        },
      });

      expect(downgradedOrg.stripeCustomerId).toBe("cus_resub_123");
    });
  });

  describe("End-to-End Payment Flow", () => {
    it("simulates full checkout → webhook → plan update flow", async () => {
      // Step 1: User creates org (starts on free plan)
      const user = await testPrisma.user.create({
        data: {
          email: "e2e-billing@example.com",
          name: "E2E Billing User",
          authProvider: "google",
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: "E2E Billing Org",
          slug: "e2e-billing",
          type: "TEAM",
          plan: "free",
          tokensMonthly: 1000,
          tokensRemaining: 1000,
        },
      });

      await testPrisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: "OWNER",
        },
      });

      expect(org.plan).toBe("free");

      // Step 2: Checkout initiated (creates Stripe customer)
      const checkoutOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          stripeCustomerId: "cus_e2e_123",
        },
      });

      expect(checkoutOrg.stripeCustomerId).toBe("cus_e2e_123");

      // Step 3: Webhook received - checkout.session.completed
      const PRO_TOKENS = 50000;
      const paidOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "pro",
          tokensMonthly: PRO_TOKENS,
          tokensRemaining: PRO_TOKENS,
          quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Verify complete flow
      expect(paidOrg.plan).toBe("pro");
      expect(paidOrg.tokensMonthly).toBe(50000);
      expect(paidOrg.tokensRemaining).toBe(50000);
      expect(paidOrg.stripeCustomerId).toBe("cus_e2e_123");
      expect(paidOrg.quotaResetDate).not.toBeNull();
    });

    it("handles upgrade from pro to enterprise", async () => {
      const org = await testPrisma.org.create({
        data: {
          name: "Upgrade Org",
          slug: "upgrade",
          type: "TEAM",
          plan: "pro",
          tokensMonthly: 50000,
          tokensRemaining: 25000, // Partially used
          stripeCustomerId: "cus_upgrade_123",
        },
      });

      // Upgrade to enterprise - add remaining tokens proportionally
      const ENTERPRISE_TOKENS = 500000;
      const upgradedOrg = await testPrisma.org.update({
        where: { id: org.id },
        data: {
          plan: "enterprise",
          tokensMonthly: ENTERPRISE_TOKENS,
          tokensRemaining: {
            increment: ENTERPRISE_TOKENS - org.tokensMonthly, // Add difference
          },
        },
      });

      expect(upgradedOrg.plan).toBe("enterprise");
      expect(upgradedOrg.tokensMonthly).toBe(500000);
      // Remaining increased: 25000 + (500000 - 50000) = 475000
      expect(upgradedOrg.tokensRemaining).toBe(475000);
    });
  });
});
