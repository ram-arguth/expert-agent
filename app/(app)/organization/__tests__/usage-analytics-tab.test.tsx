/**
 * Usage Analytics Tab Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { UsageAnalyticsTab } from "../usage-analytics-tab";
import * as React from "react";

// Mock workspace context
const mockUseWorkspace = vi.fn();
vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// Mock Select components to avoid internal errors
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    options,
    className,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    options: { value: string; label: string }[];
    className?: string;
  }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      className={className}
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

const mockAnalytics = {
  period: { start: "2026-01-01", end: "2026-01-31", days: 30 },
  totals: { tokensUsed: 50000, queryCount: 100 },
  byUser: [
    {
      userId: "user-1",
      userName: "Alice",
      userEmail: "alice@test.com",
      tokensUsed: 30000,
      queryCount: 60,
      percentage: 60,
    },
    {
      userId: "user-2",
      userName: "Bob",
      userEmail: "bob@test.com",
      tokensUsed: 20000,
      queryCount: 40,
      percentage: 40,
    },
  ],
  byAgent: [
    {
      agentId: "ux-analyst",
      agentName: "UX Analyst",
      tokensUsed: 35000,
      queryCount: 70,
      percentage: 70,
    },
    {
      agentId: "legal-advisor",
      agentName: "Legal Advisor",
      tokensUsed: 15000,
      queryCount: 30,
      percentage: 30,
    },
  ],
};

describe("UsageAnalyticsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading skeleton while fetching", () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: true,
      });

      render(<UsageAnalyticsTab />);
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("no org context", () => {
    it("shows message to select organization", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: null,
        isLoading: false,
      });

      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText(/select an organization/i)).toBeInTheDocument();
      });
    });
  });

  describe("with data", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAnalytics),
      } as Response);
    });

    it("renders total tokens used", async () => {
      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText("50.0K")).toBeInTheDocument();
      });
    });

    it("renders total queries", async () => {
      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });
    });

    it("renders user usage list", async () => {
      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
      });
    });

    it("renders agent usage list", async () => {
      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText("UX Analyst")).toBeInTheDocument();
        expect(screen.getByText("Legal Advisor")).toBeInTheDocument();
      });
    });

    it("shows query counts for users", async () => {
      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText("60 queries")).toBeInTheDocument();
      });
    });
  });

  describe("empty state", () => {
    it("handles no usage data", async () => {
      mockUseWorkspace.mockReturnValue({
        activeOrg: { id: "org-123", name: "Test Org" },
        isLoading: false,
      });

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            period: { start: "", end: "", days: 30 },
            totals: { tokensUsed: 0, queryCount: 0 },
            byUser: [],
            byAgent: [],
          }),
      } as Response);

      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getAllByText(/no usage data/i)).toHaveLength(2);
      });
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

      render(<UsageAnalyticsTab />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
      });
    });
  });
});
