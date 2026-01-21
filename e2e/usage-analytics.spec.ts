/**
 * E2E Tests: Usage Analytics
 *
 * Tests the usage analytics dashboard including:
 * - Token usage visualization
 * - Date range filtering
 * - Per-user and per-agent breakdowns
 * - Export functionality
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1 Admin Interfaces
 */

import { test, expect } from "@playwright/test";

const ORG_ADMIN = {
  id: "e2e-admin-1",
  email: "admin@example.com",
  name: "Team Admin",
  provider: "google",
  memberships: [{ orgId: "org-1", orgName: "Test Team", role: "ADMIN" }],
};

test.describe("Usage Analytics", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Usage API
    await page.route("**/api/org/*/usage*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          period: { start: "2025-01-01", end: "2025-01-31", days: 30 },
          totals: { tokensUsed: 150000, queryCount: 42 },
          byUser: [
            {
              userId: "u1",
              userName: "Alice",
              userEmail: "alice@example.com",
              tokensUsed: 100000,
              queryCount: 30,
              percentage: 66,
            },
            {
              userId: "u2",
              userName: "Bob",
              userEmail: "bob@example.com",
              tokensUsed: 50000,
              queryCount: 12,
              percentage: 33,
            },
          ],
          byAgent: [
            {
              agentId: "legal-advisor",
              agentName: "Legal Advisor",
              tokensUsed: 120000,
              queryCount: 35,
              percentage: 80,
            },
            {
              agentId: "ux-analyst",
              agentName: "UX Analyst",
              tokensUsed: 30000,
              queryCount: 7,
              percentage: 20,
            },
          ],
        }),
      });
    });
  });

  test.use({
    extraHTTPHeaders: {
      "X-E2E-Test-Principal": JSON.stringify(ORG_ADMIN),
      "X-E2E-Test-Secret": process.env.E2E_TEST_SECRET || "test-secret-for-dev",
    },
  });

  test("analytics tab displays summary cards", async ({ page }) => {
    await page.goto("/organization");
    const tab = page.getByRole("tab", { name: /analytics|usage/i });
    if ((await tab.count()) > 0) await tab.click();

    // Check totals
    await expect(page.getByText("150.0K")).toBeVisible(); // 150,000 formatted
    await expect(page.getByText("42")).toBeVisible(); // Query count
  });

  test("breakdowns rendering", async ({ page }) => {
    await page.goto("/organization");
    const tab = page.getByRole("tab", { name: /analytics|usage/i });
    if ((await tab.count()) > 0) await tab.click();

    // Check user breakdown
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();

    // Check agent breakdown
    await expect(page.getByText("Legal Advisor")).toBeVisible();
    await expect(page.getByText("UX Analyst")).toBeVisible();
  });

  test("date range sorting", async ({ page }) => {
    await page.goto("/organization");
    const tab = page.getByRole("tab", { name: /analytics|usage/i });
    if ((await tab.count()) > 0) await tab.click();

    const rangeSelect = page.getByRole("combobox").first(); // Typically the date filters is first or distinct
    if ((await rangeSelect.count()) > 0) {
      await rangeSelect.click();
      await page.getByRole("option", { name: /last 7 days/i }).click();
      // API call will be re-triggered (mock returns same data, but ensures no crash)
      await expect(page.getByText("Legal Advisor")).toBeVisible();
    }
  });

  test("export button exists", async ({ page }) => {
    await page.goto("/organization");
    const tab = page.getByRole("tab", { name: /analytics|usage/i });
    if ((await tab.count()) > 0) await tab.click();

    const exportBtn = page.getByRole("button", { name: /export/i });
    await expect(exportBtn).toBeVisible();
  });
});
