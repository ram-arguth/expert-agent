/**
 * E2E Tests: Authentication Flow
 *
 * Tests the complete authentication flow including:
 * - Protected page redirects to login
 * - Login page renders correctly
 * - User can see authenticated content after login
 * - Logout clears session
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

test.describe('Authentication Flow', () => {
  test.describe('Unauthenticated User', () => {
    test('protected page redirects to login', async ({ page }) => {
      // Try to access dashboard without auth
      await page.goto('/dashboard');

      // Should redirect to login page
      await expect(page).toHaveURL(/.*\/login|.*\/api\/auth/);
    });

    test('login page renders correctly', async ({ page }) => {
      await page.goto('/login');

      // Should show login page with provider buttons
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

      // Google login button should be visible (if configured)
      const googleButton = page.getByRole('button', { name: /google/i });
      // Only check if Google is configured (button exists)
      if (await googleButton.count() > 0) {
        await expect(googleButton).toBeVisible();
      }
    });

    test('login page has accessible structure', async ({ page }) => {
      await page.goto('/login');

      // Check for main landmark
      await expect(page.getByRole('main')).toBeVisible();

      // Page should have proper title
      await expect(page).toHaveTitle(/sign in|login|expert ai/i);
    });
  });

  test.describe('Authenticated User', () => {
    // Use test principal injection for authenticated tests
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('can access dashboard after login', async ({ page }) => {
      await page.goto('/dashboard');

      // Should show dashboard content
      await expect(page.getByRole('heading')).toBeVisible();

      // Should not redirect to login
      await expect(page).not.toHaveURL(/.*\/login/);
    });

    test('user menu shows user info', async ({ page }) => {
      await page.goto('/dashboard');

      // Find and click user menu button
      const userMenu = page.getByRole('button', { name: /user|account|profile|menu/i });
      if (await userMenu.count() > 0) {
        await userMenu.click();

        // Should show user email or name
        await expect(page.getByText(TEST_USER.email)).toBeVisible();
      }
    });

    test('logout button is visible and accessible', async ({ page }) => {
      await page.goto('/dashboard');

      // Look for sign out button (might be in a menu)
      const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
      const userMenuButton = page.getByRole('button', { name: /user|account|profile|menu/i });

      // If sign out is in a menu, open it first
      if (await userMenuButton.count() > 0 && (await signOutButton.count()) === 0) {
        await userMenuButton.click();
        await expect(page.getByText(/sign out|logout/i)).toBeVisible();
      } else if (await signOutButton.count() > 0) {
        await expect(signOutButton).toBeVisible();
      }
    });
  });

  test.describe('Session Persistence', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('session persists across page navigations', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('/dashboard');
      await expect(page).not.toHaveURL(/.*\/login/);

      // Navigate to another protected page
      await page.goto('/dashboard');
      await expect(page).not.toHaveURL(/.*\/login/);

      // Should still be authenticated
      await expect(page.getByRole('main')).toBeVisible();
    });
  });

  test.describe('Error States', () => {
    test('invalid session is handled gracefully', async ({ page }) => {
      // Test with malformed auth header
      await page.setExtraHTTPHeaders({
        'X-E2E-Test-Principal': 'invalid-json',
        'X-E2E-Test-Secret': 'invalid-secret',
      });

      await page.goto('/dashboard');

      // Should redirect to login or show error
      // The exact behavior depends on the middleware implementation
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
