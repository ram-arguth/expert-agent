/**
 * SSO Config Tab Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { SSOConfigTab } from "../sso-config-tab";
import * as React from "react";

// Mock workspace context
const mockUseWorkspace = vi.fn();
vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// Mock Select component
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    options,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock fetch
global.fetch = vi.fn();

const mockConfig = {
  domain: "acme.com",
  domainVerified: true,
  verificationToken: "token-123",
  ssoConfig: { provider: "saml", entityId: "entity-1" },
  isEnterprise: true,
};

describe("SSOConfigTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows skeleton while loading", () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123" },
        isLoading: true,
      });

      render(<SSOConfigTab />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("no org context", () => {
    it("shows message to select organization", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: null,
        isLoading: false,
      });

      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByText(/select an organization/i)).toBeInTheDocument();
      });
    });
  });

  describe("with config", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as Response);
    });

    it("displays domain verification status", async () => {
      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByText("acme.com")).toBeInTheDocument();
        expect(screen.getByText("Verified")).toBeInTheDocument();
      });
    });

    it("displays verification token when not verified", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockConfig,
            domainVerified: false,
          }),
      } as Response);

      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByText(/expert-ai-verify=/)).toBeInTheDocument();
      });
    });

    it("shows SSO provider selector", async () => {
      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByTestId("select")).toBeInTheDocument();
      });
    });

    it("shows save button", async () => {
      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByText("Save Configuration")).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    it("shows error message on fetch failure", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as Response);

      render(<SSOConfigTab />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });
    });
  });
});
