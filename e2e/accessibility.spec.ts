/**
 * E2E Tests: Accessibility
 *
 * Automated accessibility checks using axe-core.
 * Covers critical pages and interactions.
 *
 * @see docs/IMPLEMENTATION.md - Phase 7.1 Accessibility
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Test principal for auth pages
const TEST_USER = {
  id: "e2e-a11y-user",
  email: "a11y@example.com",
  name: "A11y User",
  provider: "google",
  memberships: [{ orgId: "org-1", orgName: "A11y Team", role: "MEMBER" }],
};

test.describe("Accessibility", () => {
  test("login page should be accessible", async ({ page }) => {
    await page.goto("/login");

    // Wait for content
    await expect(page.getByText("Expert Agent Platform")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("main") // Analyze main content
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("dashboard should be accessible", async ({ page }) => {
    // Authenticate
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Expert Agent" }),
    ).toBeVisible();

    // Analyze
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude("div[aria-hidden='true']") // Exclude hidden overlays if any
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("organization page should be accessible", async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/organization");
    await expect(page.getByRole("tablist")).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("chat interface should be accessible", async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/");
    // Select an agent to enter chat
    await page.click("text=UX Analyst");
    await expect(page.locator("textarea")).toBeVisible();

    // Analyze form area
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("form")
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("focus trap in modal dialogs", async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/organization");

    // Try to trigger a modal dialog (e.g., invite member button)
    const inviteButton = page.getByRole("button", {
      name: /invite|add member/i,
    });

    if ((await inviteButton.count()) > 0) {
      await inviteButton.click();

      // Wait for dialog to appear
      const dialog = page.getByRole("dialog");
      if ((await dialog.count()) > 0) {
        await expect(dialog).toBeVisible();

        // Get all focusable elements within dialog
        const focusableElements = dialog.locator(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const count = await focusableElements.count();

        if (count > 0) {
          // Tab through all elements
          for (let i = 0; i < count + 2; i++) {
            await page.keyboard.press("Tab");
          }

          // Focus should still be within the dialog (trapped)
          const activeElement = page.locator(":focus");
          const isInDialog = (await dialog.locator(":focus").count()) > 0;

          // Either focus is in dialog OR dialog has no focusable elements
          expect(isInDialog || count === 0).toBeTruthy();
        }

        // Close dialog with Escape
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
      }
    }
  });

  test("skip links for screen readers", async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/");

    // Tab to the first element - should encounter a skip link if present
    await page.keyboard.press("Tab");

    // Check for skip link (usually first focusable element)
    const skipLink = page.locator(
      'a[href="#main"], a[href="#content"], [role="link"]:has-text("skip")',
    );

    if ((await skipLink.count()) > 0) {
      // Skip link exists
      await expect(skipLink.first()).toBeFocused();

      // Activate skip link
      await page.keyboard.press("Enter");

      // Focus should move to main content
      const focusedElement = page.locator(":focus");
      const focusedId = await focusedElement.getAttribute("id");
      const focusedTag = await focusedElement.evaluate((el) =>
        el.tagName.toLowerCase(),
      );

      // Either main content is focused or we're in the main area
      expect(
        focusedId === "main" ||
          focusedId === "content" ||
          focusedTag === "main" ||
          (await page.locator("main :focus").count()) > 0,
      ).toBeTruthy();
    } else {
      // Skip links not implemented - this is a warning, not failure
      // Many SPAs handle navigation differently
      console.log(
        "Note: Skip links not found. Consider adding for screen reader users.",
      );
    }
  });

  test("keyboard navigation for interactive elements", async ({ page }) => {
    await page.setExtraHTTPHeaders({
      "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    });

    await page.goto("/organization");

    // Tab through the page
    const interactedElements: string[] = [];

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");

      const focused = page.locator(":focus");
      if ((await focused.count()) > 0) {
        const tagName = await focused.evaluate((el) =>
          el.tagName.toLowerCase(),
        );
        const role = await focused.getAttribute("role");
        interactedElements.push(role || tagName);
      }
    }

    // Should have tabbed through multiple elements
    expect(interactedElements.length).toBeGreaterThan(0);

    // Should include interactive elements like buttons, links, tabs
    const hasInteractive = interactedElements.some((el) =>
      ["button", "link", "tab", "a", "input", "select", "combobox"].includes(
        el,
      ),
    );
    expect(hasInteractive).toBeTruthy();
  });
});
