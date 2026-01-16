/**
 * Billing Tab Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BillingTab } from "../billing-tab";
import * as React from "react";

// Mock workspace context
const mockUseWorkspace = vi.fn();
vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// Mock billing components
vi.mock("@/components/billing/usage-indicator", () => ({
  UsageIndicator: ({ detailed }: { detailed?: boolean }) => (
    <div data-testid="usage-indicator" data-detailed={detailed}>
      Usage Indicator
    </div>
  ),
}));

vi.mock("@/components/billing/upgrade-button", () => ({
  UpgradeButton: ({
    children,
    priceId,
    orgId,
  }: {
    children: React.ReactNode;
    priceId: string;
    orgId: string;
  }) => (
    <button
      data-testid="upgrade-button"
      data-price-id={priceId}
      data-org-id={orgId}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/billing/manage-subscription-button", () => ({
  ManageSubscriptionButton: ({
    children,
    orgId,
  }: {
    children: React.ReactNode;
    orgId: string;
  }) => (
    <button data-testid="manage-subscription-button" data-org-id={orgId}>
      {children}
    </button>
  ),
}));

// Mock fetch
global.fetch = vi.fn();

describe("BillingTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching", () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: true,
      });

      render(<BillingTab />);
      // Should show skeleton elements
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("no org context", () => {
    it("shows message to select organization", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: null,
        isLoading: false,
      });

      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText(/select an organization/i)).toBeInTheDocument();
      });
    });
  });

  describe("free plan", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: {
              name: "Free",
              tier: "FREE",
              status: "active",
              tokensMonthly: 1000,
            },
            hasStripeCustomer: false,
          }),
      } as Response);
    });

    it("renders free plan info", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText("Free")).toBeInTheDocument();
      });

      expect(screen.getByText("$0/month")).toBeInTheDocument();
    });

    it("shows upgrade button for free tier", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByTestId("upgrade-button")).toBeInTheDocument();
      });
    });

    it("does not show manage subscription for free tier", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText("Free")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("manage-subscription-button"),
      ).not.toBeInTheDocument();
    });

    it("shows usage indicator", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByTestId("usage-indicator")).toBeInTheDocument();
      });

      expect(screen.getByTestId("usage-indicator")).toHaveAttribute(
        "data-detailed",
        "true",
      );
    });
  });

  describe("pro plan", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-456", name: "Pro Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: {
              name: "Pro",
              tier: "PRO",
              status: "active",
              tokensMonthly: 50000,
              priceId: "price_pro",
              nextBillingDate: "2026-02-16T00:00:00Z",
            },
            hasStripeCustomer: true,
          }),
      } as Response);
    });

    it("renders pro plan info", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText("Pro")).toBeInTheDocument();
      });

      expect(screen.getByText("$29/month")).toBeInTheDocument();
    });

    it("shows manage subscription button", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(
          screen.getByTestId("manage-subscription-button"),
        ).toBeInTheDocument();
      });
    });

    it("shows next billing date", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText(/next billing/i)).toBeInTheDocument();
      });
    });

    it("does not show upgrade button for paid tier", async () => {
      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText("Pro")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("upgrade-button")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message on fetch failure", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as Response);

      render(<BillingTab />);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to fetch billing info/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("plan features", () => {
    it("shows plan features list", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: {
              name: "Free",
              tier: "FREE",
              status: "active",
              tokensMonthly: 1000,
            },
            hasStripeCustomer: false,
          }),
      } as Response);

      render(<BillingTab />);

      await waitFor(() => {
        expect(screen.getByText("Plan Features")).toBeInTheDocument();
      });

      expect(screen.getByText("1,000 tokens/month")).toBeInTheDocument();
    });
  });
});
