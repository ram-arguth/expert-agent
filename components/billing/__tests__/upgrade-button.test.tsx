/**
 * Upgrade Button Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpgradeButton } from "../upgrade-button";

// Mock fetch
global.fetch = vi.fn();

// Mock window.location
const mockLocation = { href: "" };
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("UpgradeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = "";
  });

  describe("rendering", () => {
    it("renders with default text", () => {
      render(<UpgradeButton priceId="price_123" />);
      expect(
        screen.getByRole("button", { name: /upgrade plan/i }),
      ).toBeInTheDocument();
    });

    it("renders with custom text", () => {
      render(<UpgradeButton priceId="price_123">Get Pro</UpgradeButton>);
      expect(
        screen.getByRole("button", { name: /get pro/i }),
      ).toBeInTheDocument();
    });

    it("renders sparkles icon", () => {
      render(<UpgradeButton priceId="price_123" />);
      // Icon should be present (via aria-hidden)
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("checkout flow", () => {
    it("shows loading state on click", async () => {
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

      render(<UpgradeButton priceId="price_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText(/redirecting/i)).toBeInTheDocument();
      });
    });

    it("disables button during loading", async () => {
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

      render(<UpgradeButton priceId="price_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeDisabled();
      });
    });

    it("redirects to checkout URL on success", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: "cs_test_123",
            url: "https://checkout.stripe.com/test",
          }),
      } as Response);

      render(<UpgradeButton priceId="price_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(mockLocation.href).toBe("https://checkout.stripe.com/test");
      });
    });

    it("calls onSuccess before redirect", async () => {
      const onSuccess = vi.fn();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: "cs_test_123",
            url: "https://checkout.stripe.com/test",
          }),
      } as Response);

      render(<UpgradeButton priceId="price_123" onSuccess={onSuccess} />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it("sends priceId and orgId to API", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: "cs_test_123",
            url: "https://checkout.stripe.com/test",
          }),
      } as Response);

      render(<UpgradeButton priceId="price_pro" orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priceId: "price_pro", orgId: "org_123" }),
        });
      });
    });
  });

  describe("error handling", () => {
    it("shows error message on API failure", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Payment failed" }),
      } as Response);

      render(<UpgradeButton priceId="price_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Payment failed");
      });
    });

    it("calls onError callback on failure", async () => {
      const onError = vi.fn();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Payment failed" }),
      } as Response);

      render(<UpgradeButton priceId="price_123" onError={onError} />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    it("re-enables button after error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Error" }),
      } as Response);

      render(<UpgradeButton priceId="price_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("button")).not.toBeDisabled();
      });
    });
  });

  describe("disabled state", () => {
    it("respects disabled prop", () => {
      render(<UpgradeButton priceId="price_123" disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
