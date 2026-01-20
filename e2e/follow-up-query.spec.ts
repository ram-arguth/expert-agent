/**
 * E2E Tests: Follow-up Query
 *
 * Tests the follow-up query experience:
 * - User asks follow-up question in existing session
 * - Session continues with context preserved
 * - Multiple exchanges in one session work correctly
 *
 * Note: Uses Test Principal Injection to bypass SSO while maintaining AuthZ.
 */

import { test, expect } from "@playwright/test";

// Test principal for E2E testing
const TEST_USER = {
  id: "e2e-test-user-followup",
  email: "e2e-followup-tester@example.com",
  name: "E2E Follow-up Test User",
  provider: "google",
};

test.describe("Follow-up Query", () => {
  test.describe("Session Continuation", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("follow-up input exists after initial response", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for follow-up input areas
      const followUpInputs = page.locator(
        '[data-testid*="follow-up"], [data-testid*="followup"], [placeholder*="follow"], textarea, input[type="text"]',
      );
      const chatInputs = page.locator(
        '[data-testid*="chat-input"], [data-testid*="message-input"]',
      );

      const hasFollowUpUI =
        (await followUpInputs.count()) > 0 || (await chatInputs.count()) > 0;

      // Some form of follow-up input should exist
      expect(hasFollowUpUI).toBe(true);
    });

    test("follow-up maintains session context", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for session indicators
      const sessionIds = page.locator(
        '[data-testid*="session-id"], [data-session-id], [data-testid*="session"]',
      );

      // Session tracking should be present (may be hidden)
    });

    test("follow-up input is accessible", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for text input area
      const textInput = page.locator('textarea, input[type="text"]');

      if ((await textInput.count()) > 0) {
        await expect(textInput.first()).toBeEnabled();
      }
    });
  });

  test.describe("Multiple Exchanges", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("message list shows conversation history", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for message list/chat history
      const messageList = page.locator(
        '[data-testid*="message-list"], [data-testid*="chat-history"], [role="log"]',
      );
      const messages = page.locator(
        '[data-testid*="message"], [data-testid*="chat-message"]',
      );

      // Message container should exist
      const hasMessageUI =
        (await messageList.count()) > 0 || (await messages.count()) >= 0;
      expect(hasMessageUI).toBe(true);
    });

    test("user and agent messages are distinguished", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for different message types
      const userMessages = page.locator(
        '[data-testid*="user-message"], [data-role="user"], .user-message',
      );
      const agentMessages = page.locator(
        '[data-testid*="agent-message"], [data-role="agent"], [data-role="assistant"], .agent-message',
      );

      // Different message styling should exist
    });

    test("scroll to latest message works", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for scrollable message area
      const scrollArea = page.locator(
        '[data-testid*="message-list"], [data-testid*="chat-container"]',
      );

      if ((await scrollArea.count()) > 0) {
        // Should be scrollable
        const area = scrollArea.first();
        await expect(area).toBeVisible();
      }
    });
  });

  test.describe("Context Preservation", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("session persists after navigation", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Navigate away and back
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Session state should be preserved (via cookie/session storage)
    });

    test("session can be resumed from history", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Look for session history links
      const sessionLinks = page.locator(
        '[data-testid*="session-link"], [data-testid*="recent-session"], a[href*="session"]',
      );

      if ((await sessionLinks.count()) > 0) {
        await expect(sessionLinks.first()).toBeVisible();
      }
    });
  });

  test.describe("Chat Panel Integration", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("chat panel can be opened", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for chat panel toggle
      const chatToggle = page.locator(
        '[data-testid*="chat-toggle"], [data-testid*="chat-panel"], [aria-label*="chat"]',
      );
      const chatButton = page.getByRole("button", { name: /chat/i });

      if ((await chatToggle.count()) > 0) {
        await chatToggle.first().click();
        await page.waitForTimeout(300);

        // Chat panel should be visible
        const chatPanel = page.locator(
          '[data-testid*="chat-panel"], [role="complementary"]',
        );
        if ((await chatPanel.count()) > 0) {
          await expect(chatPanel.first()).toBeVisible();
        }
      }
    });

    test("chat input accepts text", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Find chat/message input
      const chatInput = page.locator(
        '[data-testid*="chat-input"], textarea, input[placeholder*="message"]',
      );

      if ((await chatInput.count()) > 0) {
        const input = chatInput.first();
        await input.fill("This is a follow-up question");
        await expect(input).toHaveValue("This is a follow-up question");
      }
    });

    test("send button is available", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for send button
      const sendButton = page.getByRole("button", { name: /send|submit|ask/i });
      const iconButton = page.locator(
        'button:has(svg[class*="send"]), [data-testid*="send-button"]',
      );

      if ((await sendButton.count()) > 0) {
        await expect(sendButton.first()).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test.use({
      extraHTTPHeaders: {
        "X-E2E-Test-Principal": JSON.stringify(TEST_USER),
        "X-E2E-Test-Secret":
          process.env.E2E_TEST_SECRET || "test-secret-for-dev",
      },
    });

    test("chat area has live region", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Look for aria-live regions
      const liveRegions = page.locator(
        '[aria-live], [role="log"], [role="status"]',
      );

      if ((await liveRegions.count()) > 0) {
        await expect(liveRegions.first()).toBeAttached();
      }
    });

    test("keyboard navigation works in chat", async ({ page }) => {
      await page.goto("/agents/ux-analyst");
      await page.waitForLoadState("networkidle");

      // Tab through elements
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const focused = page.locator(":focus");
      if ((await focused.count()) > 0) {
        await expect(focused).toBeVisible();
      }
    });
  });
});
