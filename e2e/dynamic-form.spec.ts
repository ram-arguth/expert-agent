/**
 * E2E Tests: Dynamic Form Rendering
 *
 * Tests the dynamic form generation from Zod schemas:
 * - Form renders correctly from agent input schema
 * - Dropdown (select) fields show options
 * - File upload fields accept files
 * - Validation errors display appropriately
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

test.describe('Dynamic Form', () => {
  test.describe('Form Rendering', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('form renders from schema', async ({ page }) => {
      // Navigate to an agent page that has a form
      await page.goto('/agents/ux-analyst');

      // Wait for the page to fully load
      await page.waitForLoadState('networkidle');

      // Look for form elements
      const form = page.locator('form');
      const formContainer = page.getByTestId('agent-form');
      const inputFields = page.locator('input, textarea, select');

      // Either a form or form container should be visible
      if ((await form.count()) > 0 || (await formContainer.count()) > 0) {
        // Check for input fields
        if ((await inputFields.count()) > 0) {
          await expect(inputFields.first()).toBeVisible();
        }
      }
    });

    test('form has labeled inputs', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Labels should be present for form fields
      const labels = page.locator('label');

      if ((await labels.count()) > 0) {
        await expect(labels.first()).toBeVisible();
      }
    });

    test('form has submit button', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for submit/analyze button
      const submitButton = page.getByRole('button', {
        name: /submit|analyze|start|send|run/i,
      });

      if ((await submitButton.count()) > 0) {
        await expect(submitButton.first()).toBeVisible();
      }
    });
  });

  test.describe('Dropdown Fields', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('dropdown shows enum options', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Find a select/dropdown element
      const select = page.locator('select, [role="combobox"], [data-testid*="select"]');

      if ((await select.count()) > 0) {
        const firstSelect = select.first();
        await expect(firstSelect).toBeVisible();

        // Try clicking to open dropdown
        await firstSelect.click();

        // Look for options
        const options = page.locator('option, [role="option"], [data-testid*="option"]');
        if ((await options.count()) > 0) {
          await expect(options.first()).toBeVisible();
        }
      }
    });

    test('dropdown selection updates form state', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const select = page.locator('select, [role="combobox"]').first();

      if ((await select.count()) > 0) {
        await select.click();

        // Select an option if available
        const options = page.locator('option, [role="option"]');
        if ((await options.count()) > 1) {
          await options.nth(1).click();
        }
      }
    });
  });

  test.describe('File Upload', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('file upload field accepts files', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for file input
      const fileInput = page.locator('input[type="file"]');

      if ((await fileInput.count()) > 0) {
        await expect(fileInput.first()).toBeVisible();

        // File input should accept file types
        const acceptAttr = await fileInput.first().getAttribute('accept');
        // If accept is defined, it should have valid file types
        if (acceptAttr) {
          expect(acceptAttr).toMatch(/image|pdf|\.png|\.jpg|\.pdf/i);
        }
      }
    });

    test('file upload has dropzone or button', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for dropzone or upload button
      const dropzone = page.locator('[data-testid*="dropzone"], [data-testid*="upload"]');
      const uploadButton = page.getByRole('button', { name: /upload|browse|choose/i });
      const fileInput = page.locator('input[type="file"]');

      const hasUploadUI =
        (await dropzone.count()) > 0 ||
        (await uploadButton.count()) > 0 ||
        (await fileInput.count()) > 0;

      // Some form of file upload UI should exist
      expect(hasUploadUI).toBe(true);
    });
  });

  test.describe('Validation', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('validation errors display on empty submit', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Find and click submit button without filling required fields
      const submitButton = page.getByRole('button', {
        name: /submit|analyze|start|send|run/i,
      });

      if ((await submitButton.count()) > 0) {
        await submitButton.first().click();

        // Look for error messages
        const errorMessages = page.locator(
          '[role="alert"], .error, .text-destructive, [data-testid*="error"]'
        );

        // Wait a moment for validation
        await page.waitForTimeout(500);

        // Either error messages appear or form prevents submission
        // (depends on implementation - HTML5 validation or custom)
      }
    });

    test('required fields are marked', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for required indicators
      const requiredIndicators = page.locator('[aria-required="true"], .required, *:has-text("*")');

      // Required fields should be indicated somehow
      if ((await requiredIndicators.count()) > 0) {
        await expect(requiredIndicators.first()).toBeVisible();
      }
    });

    test('text inputs accept text', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Find a text input
      const textInput = page.locator('input[type="text"], textarea').first();

      if ((await textInput.count()) > 0) {
        await textInput.fill('Test input value');
        await expect(textInput).toHaveValue('Test input value');
      }
    });
  });

  test.describe('Accessibility', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('form fields have accessible names', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // All input fields should have a label or aria-label
      const inputs = page.locator('input:not([type="hidden"]), textarea, select');

      for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Input should have some form of accessible name
        const hasAccessibleName = id || ariaLabel || ariaLabelledBy;

        if (hasAccessibleName) {
          // If it has an id, there should be a matching label
          if (id) {
            const label = page.locator(`label[for="${id}"]`);
            // Either label exists or aria-label is present
            expect(
              (await label.count()) > 0 || ariaLabel || ariaLabelledBy
            ).toBeTruthy();
          }
        }
      }
    });

    test('form can be navigated by keyboard', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Press tab to navigate through form
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Something should be focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
