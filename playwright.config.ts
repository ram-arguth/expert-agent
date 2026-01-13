import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Expert Agent Platform E2E Tests
 *
 * Features:
 * - Test Principal Injection for authenticated flows
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - CI-aware retry and parallelization settings
 * - Screenshot and trace capture on failure
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter: list for CI, HTML for local development
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: 'test-results/e2e-results.xml' }]]
    : 'html',

  // Timeouts
  timeout: 30000, // Per-test timeout
  expect: {
    timeout: 10000, // Assertion timeout
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Default viewport
    viewport: { width: 1280, height: 720 },

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000,
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewport (optional, uncomment to enable)
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['iPhone 13'] },
    // },
  ],

  // Web server for local development
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120000, // 2 minutes for cold start
      },

  // Output directory for test artifacts
  outputDir: 'test-results/',
});

