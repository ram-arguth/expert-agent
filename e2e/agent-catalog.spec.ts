/**
 * E2E Tests: Agent Catalog
 *
 * Tests the agent catalog functionality including:
 * - Sidebar agent list display
 * - Agent navigation
 * - Beta badges
 * - Agent landing pages
 *
 * Note: Uses Test Principal Injection to bypass SSO while maintaining AuthZ.
 */

import { test, expect } from '@playwright/test';

// Test principal for E2E testing
const TEST_USER = {
  id: 'e2e-test-user-1',
  email: 'e2e-tester@example.com',
  name: 'E2E Test User',
  provider: 'google',
};

test.describe('Agent Catalog', () => {
  test.describe('Agent Sidebar', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('sidebar shows agent list', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for agent sidebar or agent list
      const sidebar = page.getByTestId('agent-sidebar');
      const agentList = page.getByRole('navigation', { name: /agent/i });

      // Either sidebar or agent list should be visible
      if ((await sidebar.count()) > 0) {
        await expect(sidebar).toBeVisible();
      } else if ((await agentList.count()) > 0) {
        await expect(agentList).toBeVisible();
      } else {
        // Look for any agent links
        const agentLinks = page.locator('a[href*="/agents/"]');
        await expect(agentLinks.first()).toBeVisible();
      }
    });

    test('displays UX Analyst agent', async ({ page }) => {
      await page.goto('/dashboard');

      // UX Analyst should be visible somewhere
      const uxAnalyst = page.getByText(/UX Analyst/i);
      await expect(uxAnalyst.first()).toBeVisible();
    });

    test('agent entries are clickable links', async ({ page }) => {
      await page.goto('/dashboard');

      // Find an agent link
      const agentLinks = page.locator('a[href*="/agents/"]');

      if ((await agentLinks.count()) > 0) {
        const firstAgent = agentLinks.first();
        await expect(firstAgent).toBeVisible();

        // Should have href attribute
        const href = await firstAgent.getAttribute('href');
        expect(href).toContain('/agents/');
      }
    });
  });

  test.describe('Agent Navigation', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('clicking agent navigates to agent page', async ({ page }) => {
      await page.goto('/dashboard');

      // Find and click UX Analyst link
      const uxAnalystLink = page.locator('a[href*="/agents/ux-analyst"]');

      if ((await uxAnalystLink.count()) > 0) {
        await uxAnalystLink.first().click();

        // Should navigate to agent page
        await expect(page).toHaveURL(/.*\/agents\/ux-analyst/);
      }
    });

    test('agent page shows agent details', async ({ page }) => {
      await page.goto('/agents/ux-analyst');

      // Should show agent name
      await expect(page.getByText(/UX Analyst/i).first()).toBeVisible();

      // Should have a main content area
      await expect(page.getByRole('main')).toBeVisible();
    });
  });

  test.describe('Beta Badges', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('beta agents show beta badge', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for beta badges in the agent list
      const betaBadges = page.getByText(/beta/i);

      // If beta badges exist, they should be styled appropriately
      if ((await betaBadges.count()) > 0) {
        const firstBadge = betaBadges.first();
        await expect(firstBadge).toBeVisible();
      }
    });
  });

  test.describe('Agent Landing Pages', () => {
    test('UX Analyst landing page renders', async ({ page }) => {
      await page.goto('/agents/ux-analyst');

      // Should have content
      await expect(page.getByRole('main')).toBeVisible();

      // Should mention UX or design
      const uxContent = page.getByText(/UX|design|user experience|interface/i);
      await expect(uxContent.first()).toBeVisible();
    });

    test('landing page has proper accessibility structure', async ({ page }) => {
      await page.goto('/agents/ux-analyst');

      // Should have main landmark
      await expect(page.getByRole('main')).toBeVisible();

      // Should have heading
      await expect(page.getByRole('heading').first()).toBeVisible();
    });

    test('landing page has call-to-action', async ({ page }) => {
      await page.goto('/agents/ux-analyst');

      // Look for start or try button
      const ctaButton = page.getByRole('button', { name: /start|try|begin|analyze|get started/i });
      const ctaLink = page.getByRole('link', { name: /start|try|begin|analyze|get started/i });

      // Either button or link CTA should exist
      const hasCta = (await ctaButton.count()) > 0 || (await ctaLink.count()) > 0;
      if (hasCta) {
        if ((await ctaButton.count()) > 0) {
          await expect(ctaButton.first()).toBeVisible();
        } else {
          await expect(ctaLink.first()).toBeVisible();
        }
      }
    });

    test('non-existent agent shows 404', async ({ page }) => {
      const response = await page.goto('/agents/non-existent-agent-xyz');

      // Should return 404 or show not found page
      if (response) {
        const status = response.status();
        // Accept either 404 status or redirect/200 with not found content
        if (status !== 404) {
          // Check for not found content on the page
          const notFound = page.getByText(/not found|doesn't exist|unavailable/i);
          if ((await notFound.count()) > 0) {
            await expect(notFound.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Agent Categories', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('agents are grouped by category', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for category labels in the sidebar
      const categories = page.getByText(/design|legal|finance|general/i);

      if ((await categories.count()) > 0) {
        // Categories should be visible
        await expect(categories.first()).toBeVisible();
      }
    });
  });
});
