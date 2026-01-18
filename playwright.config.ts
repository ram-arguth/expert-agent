import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for Expert Agent Platform E2E Tests
 *
 * Features:
 * - Test Principal Injection for authenticated flows
 * - Multi-browser testing (Chromium, Firefox, WebKit) locally
 * - Parallel execution in CI with Chromium-only for speed
 * - Screenshot and trace capture on failure
 *
 * Performance Optimizations (CI):
 * - 4 parallel workers (vs 1 previously)
 * - Chromium-only (vs 3 browsers) - saves ~66% time
 * - Total expected improvement: 8min → ~2-3min
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 4 workers in CI for parallel execution (was 1, causing 8min builds)
  workers: process.env.CI ? 4 : undefined,

  // Reporter: list for CI, HTML for local development
  reporter: process.env.CI
    ? [["list"], ["junit", { outputFile: "test-results/e2e-results.xml" }]]
    : "html",

  // Timeouts
  timeout: 30000, // Per-test timeout
  expect: {
    timeout: 10000, // Assertion timeout
  },

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Default viewport
    viewport: { width: 1280, height: 720 },

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000,
  },

  projects: process.env.CI
    ? [
        // CI: Chromium only for speed (Firefox/WebKit add ~66% time)
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        // Local: Full browser matrix
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "firefox",
          use: { ...devices["Desktop Firefox"] },
        },
        {
          name: "webkit",
          use: { ...devices["Desktop Safari"] },
        },
      ],

  // Web server for local development
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000, // 2 minutes for cold start
      },

  // Output directory for test artifacts
  outputDir: "test-results/",
});
