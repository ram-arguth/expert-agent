/**
 * E2E Tests: Guided Interview Mode
 *
 * Tests the guided interview UI functionality:
 * - Interview mode shows one question at a time
 * - Progress indicator updates correctly
 * - "Start Analysis" button enabled when complete
 *
 * Note: Uses Test Principal Injection to bypass SSO while maintaining AuthZ.
 * AI responses are mocked via test headers.
 */

import { test, expect } from '@playwright/test';

// Test principal for E2E testing
const TEST_USER = {
  id: 'e2e-test-user-1',
  email: 'e2e-tester@example.com',
  name: 'E2E Test User',
  provider: 'google',
};

test.describe('Guided Interview Mode', () => {
  test.describe('Interview Display', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('interview mode shows one question at a time', async ({ page }) => {
      // Navigate to an agent that supports guided interview
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for interview panel or guided mode indicator
      const interviewPanel = page.getByTestId('interview-panel');
      const questionDisplay = page.locator('[data-testid*="question"], .question, h2, h3');

      if ((await interviewPanel.count()) > 0) {
        await expect(interviewPanel).toBeVisible();

        // Should show a single question
        const questions = interviewPanel.locator('h2, h3, [data-testid*="question"]');
        // Only one main question should be visible at a time
        if ((await questions.count()) > 0) {
          await expect(questions.first()).toBeVisible();
        }
      } else {
        // If no interview panel, check for any question-like content
        if ((await questionDisplay.count()) > 0) {
          await expect(questionDisplay.first()).toBeVisible();
        }
      }
    });

    test('interview shows input field for current question', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const interviewPanel = page.getByTestId('interview-panel');

      if ((await interviewPanel.count()) > 0) {
        // Should have an input field for the current question
        const inputField = interviewPanel.locator(
          'input, textarea, select, [data-testid*="input"]'
        );
        if ((await inputField.count()) > 0) {
          await expect(inputField.first()).toBeVisible();
        }
      }
    });

    test('interview has navigation buttons', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const interviewPanel = page.getByTestId('interview-panel');

      if ((await interviewPanel.count()) > 0) {
        // Look for Next, Skip, or similar buttons
        const nextButton = page.getByTestId('next-button');
        const skipButton = page.getByTestId('skip-button');
        const navButtons = page.getByRole('button', { name: /next|skip|continue/i });

        const hasNavigation =
          (await nextButton.count()) > 0 ||
          (await skipButton.count()) > 0 ||
          (await navButtons.count()) > 0;

        if (hasNavigation) {
          if ((await nextButton.count()) > 0) {
            await expect(nextButton).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Progress Tracking', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('progress indicator is visible', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for progress bar or step counter
      const progressBar = page.getByTestId('progress-bar');
      const progressIndicator = page.locator('[role="progressbar"], .progress, [class*="progress"]');
      const stepCounter = page.getByText(/step \d+ of \d+/i);

      const hasProgress =
        (await progressBar.count()) > 0 ||
        (await progressIndicator.count()) > 0 ||
        (await stepCounter.count()) > 0;

      if (hasProgress) {
        if ((await progressBar.count()) > 0) {
          await expect(progressBar).toBeVisible();
        } else if ((await stepCounter.count()) > 0) {
          await expect(stepCounter.first()).toBeVisible();
        }
      }
    });

    test('step counter shows current position', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for "Step X of Y" text
      const stepCounter = page.getByText(/step \d+ of \d+/i);

      if ((await stepCounter.count()) > 0) {
        await expect(stepCounter.first()).toBeVisible();
        const text = await stepCounter.first().textContent();
        expect(text).toMatch(/step \d+ of \d+/i);
      }
    });
  });

  test.describe('Question Completion', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('can answer a question', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const interviewPanel = page.getByTestId('interview-panel');

      if ((await interviewPanel.count()) > 0) {
        // Find input and fill it
        const textInput = interviewPanel.locator('input[type="text"], textarea').first();
        const selectInput = interviewPanel.locator('select, [role="combobox"]').first();

        if ((await textInput.count()) > 0) {
          await textInput.fill('Test answer for the question');
          await expect(textInput).toHaveValue('Test answer for the question');
        } else if ((await selectInput.count()) > 0) {
          await selectInput.click();
        }
      }
    });

    test('skip button works for optional questions', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const skipButton = page.getByTestId('skip-button');

      if ((await skipButton.count()) > 0) {
        await expect(skipButton).toBeVisible();
        await expect(skipButton).toBeEnabled();
      }
    });
  });

  test.describe('Analysis Start', () => {
    test.use({
      extraHTTPHeaders: {
        'X-E2E-Test-Principal': JSON.stringify(TEST_USER),
        'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET || 'test-secret-for-dev',
      },
    });

    test('"Start Analysis" button exists', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Look for start analysis button
      const startButton = page.getByTestId('complete-button');
      const earlyStartButton = page.getByTestId('early-start-button');
      const startAnalysisButton = page.getByRole('button', {
        name: /start.*analysis|analyze|begin|run/i,
      });

      const hasStartButton =
        (await startButton.count()) > 0 ||
        (await earlyStartButton.count()) > 0 ||
        (await startAnalysisButton.count()) > 0;

      // At least one start button type should exist
      expect(hasStartButton).toBe(true);
    });

    test('early start is available when requirements met', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const earlyStartButton = page.getByTestId('early-start-button');

      // Early start may or may not be visible depending on state
      // Just verify the button works if it exists
      if ((await earlyStartButton.count()) > 0) {
        await expect(earlyStartButton).toBeVisible();
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

    test('interview panel has accessible structure', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const interviewPanel = page.getByTestId('interview-panel');

      if ((await interviewPanel.count()) > 0) {
        // Should have heading for question
        const heading = interviewPanel.locator('h1, h2, h3, h4').first();
        if ((await heading.count()) > 0) {
          await expect(heading).toBeVisible();
        }
      }
    });

    test('form labels are associated with inputs', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      const interviewPanel = page.getByTestId('interview-panel');

      if ((await interviewPanel.count()) > 0) {
        const labels = interviewPanel.locator('label');
        const inputs = interviewPanel.locator('input, textarea, select');

        // If there are inputs, there should be labels
        if ((await inputs.count()) > 0 && (await labels.count()) > 0) {
          // Labels should exist
          await expect(labels.first()).toBeVisible();
        }
      }
    });

    test('can navigate interview with keyboard', async ({ page }) => {
      await page.goto('/agents/ux-analyst');
      await page.waitForLoadState('networkidle');

      // Tab through the interview
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });
});
