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
});
