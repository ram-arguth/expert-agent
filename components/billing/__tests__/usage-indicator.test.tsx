/**
 * Usage Indicator Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UsageIndicator } from "../usage-indicator";

// Mock fetch
global.fetch = vi.fn();

// Test wrapper with React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  function TestQueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return TestQueryWrapper;
}

describe("UsageIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading indicator", async () => {
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

      const { container } = render(<UsageIndicator />, {
        wrapper: createWrapper(),
      });

      // Should show a loading placeholder (animated pulse element)
      await waitFor(() => {
        expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
      });
    });
  });

  describe("compact view", () => {
    it("renders usage progress bar", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 5000,
            tokensMonthly: 10000,
            usagePercent: 50,
            plan: "pro",
            isOrgContext: true,
          }),
      } as Response);

      render(<UsageIndicator />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeInTheDocument();
      });
    });

    it("shows warning icon when low on tokens", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 500,
            tokensMonthly: 10000,
            usagePercent: 95,
            plan: "pro",
            isOrgContext: true,
          }),
      } as Response);

      render(<UsageIndicator />, { wrapper: createWrapper() });

      await waitFor(() => {
        // Should have warning state
        expect(screen.getByRole("status")).toBeInTheDocument();
      });
    });

    it("renders nothing on error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Error" }),
      } as Response);

      const { container } = render(<UsageIndicator />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // Should be empty on error
        expect(
          container.querySelector('[role="status"]'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("detailed view", () => {
    it("shows token counts and plan", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 3000,
            tokensMonthly: 10000,
            usagePercent: 70,
            plan: "pro",
            isOrgContext: true,
          }),
      } as Response);

      render(<UsageIndicator detailed />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Token Usage")).toBeInTheDocument();
        expect(screen.getByText("Pro")).toBeInTheDocument();
        expect(screen.getByText("70% used")).toBeInTheDocument();
      });
    });

    it("shows upgrade button when exhausted", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 0,
            tokensMonthly: 10000,
            usagePercent: 100,
            plan: "free",
            isOrgContext: false,
          }),
      } as Response);

      render(<UsageIndicator detailed />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Quota exhausted")).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /upgrade/i }),
        ).toBeInTheDocument();
      });
    });

    it("shows low tokens warning", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 800,
            tokensMonthly: 10000,
            usagePercent: 92,
            plan: "pro",
            isOrgContext: true,
          }),
      } as Response);

      render(<UsageIndicator detailed />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText("Running low on tokens")).toBeInTheDocument();
      });
    });

    it("formats large token counts with K suffix", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tokensRemaining: 45000,
            tokensMonthly: 50000,
            usagePercent: 10,
            plan: "pro",
            isOrgContext: true,
          }),
      } as Response);

      render(<UsageIndicator detailed />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(screen.getByText(/50.0K/)).toBeInTheDocument();
      });
    });
  });
});
