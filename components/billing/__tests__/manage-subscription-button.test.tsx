/**
 * Manage Subscription Button Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ManageSubscriptionButton } from "../manage-subscription-button";

// Mock fetch
global.fetch = vi.fn();

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", {
  value: mockWindowOpen,
  writable: true,
});

describe("ManageSubscriptionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with default text", () => {
      render(<ManageSubscriptionButton orgId="org_123" />);
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeInTheDocument();
    });

    it("renders with custom text", () => {
      render(
        <ManageSubscriptionButton orgId="org_123">
          Billing Settings
        </ManageSubscriptionButton>,
      );
      expect(
        screen.getByRole("button", { name: /billing settings/i }),
      ).toBeInTheDocument();
    });

    it("renders as outline variant", () => {
      render(<ManageSubscriptionButton orgId="org_123" />);
      // Button should have outline styling
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("portal flow", () => {
    it("shows loading state on click", async () => {
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText(/opening/i)).toBeInTheDocument();
      });
    });

    it("disables button during loading", async () => {
      vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeDisabled();
      });
    });

    it("opens portal in new tab on success", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://billing.stripe.com/portal/test",
          }),
      } as Response);

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith(
          "https://billing.stripe.com/portal/test",
          "_blank",
          "noopener,noreferrer",
        );
      });
    });

    it("calls onSuccess on successful open", async () => {
      const onSuccess = vi.fn();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://billing.stripe.com/portal/test",
          }),
      } as Response);

      render(
        <ManageSubscriptionButton orgId="org_123" onSuccess={onSuccess} />,
      );
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it("sends orgId to API", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://billing.stripe.com/portal/test",
          }),
      } as Response);

      render(<ManageSubscriptionButton orgId="org_456" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/billing/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: "org_456" }),
        });
      });
    });

    it("re-enables button after success", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: "https://billing.stripe.com/portal/test",
          }),
      } as Response);

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("button")).not.toBeDisabled();
      });
    });
  });

  describe("error handling", () => {
    it("shows error message on API failure", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "No subscription found" }),
      } as Response);

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "No subscription found",
        );
      });
    });

    it("calls onError callback on failure", async () => {
      const onError = vi.fn();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Error" }),
      } as Response);

      render(<ManageSubscriptionButton orgId="org_123" onError={onError} />);
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

      render(<ManageSubscriptionButton orgId="org_123" />);
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("button")).not.toBeDisabled();
      });
    });
  });

  describe("disabled state", () => {
    it("respects disabled prop", () => {
      render(<ManageSubscriptionButton orgId="org_123" disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});
