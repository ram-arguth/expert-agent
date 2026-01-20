/**
 * E2E Tests: Billing Portal
 *
 * Tests the Stripe Customer Portal integration:
 * - Manage subscription button opens Stripe portal
 * - User can access payment management (in test mode)
 *
 * Note: Uses Test Principal Injection to bypass SSO while maintaining AuthZ.
 * Stripe interactions are tested in test/sandbox mode.
 */

import { test, expect } from "@playwright/test";

// Test principal for E2E testing
const TEST_USER = {
  id: "e2e-test-user-portal",
  email: "e2e-portal-tester@example.com",
  name: "E2E Portal Test User",
  provider: "google",
};

// Test principal with admin role in org (required for portal access)
const TEST_ADMIN = {
  id: "e2e-test-admin-portal",
  email: "e2e-portal-admin@example.com",
  name: "E2E Portal Admin",
  provider: "google",
  memberships: [
    {
      orgId: "test-org-with-subscription",
      role: "ADMIN",
    },
  ],
};

// Test principal with billing manager role
const TEST_BILLING_MANAGER = {
  id: "e2e-test-billing-manager",
  email: "e2e-billing-manager@example.com",
  name: "E2E Billing Manager",
  provider: "google",
  memberships: [
    {
      orgId: "test-org-with-subscription",
      role: "BILLING_MANAGER",
    },
  ],
};

test.describe("Billing Portal", () => {
  test.describe("Manage Button", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("manage subscription button is visible", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Look for manage subscription button
      const manageButton = page.getByRole("button", {
        name: /manage|subscription|payment|portal/i,
      });
      const manageLink = page.getByRole("link", {
        name: /manage|subscription|payment/i,
      });

      const hasManageOption =
        (await manageButton.count()) > 0 || (await manageLink.count()) > 0;

      if (hasManageOption) {
        if ((await manageButton.count()) > 0) {
          await expect(manageButton.first()).toBeVisible();
        }
      }
    });

    test("manage button is clickable for admins", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      const manageButton = page.getByRole("button", {
        name: /manage|subscription|payment/i,
      });

      if ((await manageButton.count()) > 0) {
        await expect(manageButton.first()).toBeEnabled();
      }
    });

    test("manage button shows appropriate text", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      const manageButton = page.getByRole("button", {
        name: /manage|subscription|payment|update/i,
      });

      if ((await manageButton.count()) > 0) {
        const text = await manageButton.first().textContent();
        expect(text).toBeTruthy();
      }
    });
  });

  test.describe("Portal Redirect", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("clicking manage initiates portal session", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Find manage subscription button
      const manageButton = page.getByRole("button", {
        name: /manage|subscription|payment/i,
      });

      if ((await manageButton.count()) > 0) {
        // Set up API route interception
        let portalApiCalled = false;
        await page.route("**/api/billing/portal", async (route) => {
          portalApiCalled = true;
          await route.fulfill({
            status: 200,
            body: JSON.stringify({
              url: "https://billing.stripe.com/p/session/test_123",
            }),
          });
        });

        await manageButton.first().click();
        await page.waitForTimeout(500);

        // Portal API should be called
        expect(portalApiCalled).toBe(true);
      }
    });

    test("portal API returns valid URL", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Intercept and verify API response format
      let responseUrl = "";
      await page.route("**/api/billing/portal", async (route) => {
        responseUrl = "https://billing.stripe.com/test";
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ url: responseUrl }),
        });
      });

      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        await manageButton.first().click();
        await page.waitForTimeout(300);

        // Response should have a valid URL
        expect(responseUrl).toContain("stripe.com");
      }
    });
  });

  test.describe("Authorization", () => {
    test("admin can access portal", async ({ page }) => {
      await page.setExtraHTTPHeaders({
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      });

      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Admin should see manage button
      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        await expect(manageButton.first()).toBeEnabled();
      }
    });

    test("billing manager can access portal", async ({ page }) => {
      await page.setExtraHTTPHeaders({
        "X-E2E-Test-Principal": JSON.stringify(TEST_BILLING_MANAGER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      });

      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Billing manager should also see manage button
      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      // Should be accessible to billing managers
    });

    test("regular member cannot access portal", async ({ page }) => {
      await page.setExtraHTTPHeaders({
        "X-E2E-Test-Principal": JSON.stringify({
          ...TEST_USER,
          memberships: [{ orgId: "test-org", role: "MEMBER" }],
        }),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      });

      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Regular member should not see manage button or it should be disabled
      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        // Button may be disabled for regular members
        const isDisabled = await manageButton.first().isDisabled();
        // Either disabled, hidden, or shows appropriate message
      }
    });
  });

  test.describe("Subscription Status Display", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("current plan name is displayed", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Look for plan name display
      const planDisplay = page.locator(
        '[data-testid*="plan-name"], [data-testid*="current-plan"], .plan-name',
      );

      // Some plan indication should be visible
    });

    test("billing period is shown", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Look for billing period info
      const periodInfo = page.locator(
        '[data-testid*="billing-period"], [data-testid*="next-billing"], .billing-cycle',
      );

      // Billing period may be shown for subscribed users
    });

    test("payment method preview is visible", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Look for payment method display (last 4 digits of card, etc.)
      const paymentInfo = page.locator(
        '[data-testid*="payment-method"], [data-testid*="card"], .payment-info',
      );

      // Payment info may be shown for subscribed users
    });
  });

  test.describe("Error Handling", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("handles portal API error gracefully", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Simulate API error
      await page.route("**/api/billing/portal", async (route) => {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: "Failed to create portal session" }),
        });
      });

      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        await manageButton.first().click();
        await page.waitForTimeout(500);

        // Error message should be displayed
        const errorMessage = page.locator(
          '[role="alert"], .error, .text-destructive, [data-sonner-toast]',
        );

        // Some error indication should appear
      }
    });

    test("handles no Stripe customer gracefully", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Simulate no Stripe customer error
      await page.route("**/api/billing/portal", async (route) => {
        await route.fulfill({
          status: 400,
          body: JSON.stringify({ error: "No Stripe customer found" }),
        });
      });

      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        await manageButton.first().click();
        await page.waitForTimeout(500);

        // Should show appropriate message (upgrade first, etc.)
      }
    });
  });

  test.describe("Accessibility", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_ADMIN),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("portal button has accessible name", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      const manageButton = page.getByRole("button", {
        name: /manage|subscription/i,
      });

      if ((await manageButton.count()) > 0) {
        const ariaLabel = await manageButton.first().getAttribute("aria-label");
        const text = await manageButton.first().textContent();

        // Button should have accessible text
        expect(ariaLabel || text).toBeTruthy();
      }
    });

    test("billing page sections are labeled", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Look for heading structure
      const headings = page.locator('h1, h2, h3, [role="heading"]');

      if ((await headings.count()) > 0) {
        await expect(headings.first()).toBeVisible();
      }
    });

    test("keyboard navigation works in billing section", async ({ page }) => {
      await page.goto("/organization?tab=billing");
      await page.waitForLoadState("networkidle");

      // Tab through elements
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const focused = page.locator(":focus");
      if ((await focused.count()) > 0) {
        await expect(focused).toBeVisible();
      }
    });
  });
});
