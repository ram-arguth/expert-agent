/**
 * Pending Invites List Unit Tests
 *
 * Tests the pending invites list component including:
 * - Invite rendering with expiry status
 * - Revoke functionality
 * - Empty and loading states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PendingInvitesList } from "../pending-invites-list";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockInvites = [
  {
    id: "invite-1",
    email: "alice@example.com",
    role: "MEMBER",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    status: "PENDING" as const,
  },
  {
    id: "invite-2",
    email: "bob@example.com",
    role: "ADMIN",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    status: "PENDING" as const,
  },
  {
    id: "invite-3",
    email: "charlie@example.com",
    role: "MEMBER",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired
    status: "PENDING" as const,
  },
];

describe("PendingInvitesList", () => {
  const defaultProps = {
    invites: mockInvites,
    orgId: "org-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders all pending invites", () => {
      render(<PendingInvitesList {...defaultProps} />);

      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      expect(screen.getByText("charlie@example.com")).toBeInTheDocument();
    });

    it("shows role badges", () => {
      render(<PendingInvitesList {...defaultProps} />);

      expect(screen.getAllByText("MEMBER")).toHaveLength(2);
      expect(screen.getByText("ADMIN")).toBeInTheDocument();
    });

    it("shows expiry status", () => {
      render(<PendingInvitesList {...defaultProps} />);

      // Check for expiry text (exact text depends on current date)
      expect(screen.getByText(/days left/i)).toBeInTheDocument();
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<PendingInvitesList {...defaultProps} isLoading />);

      expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
    });

    it("shows empty state when no pending invites", () => {
      render(<PendingInvitesList {...defaultProps} invites={[]} />);

      expect(screen.getByText("No pending invitations")).toBeInTheDocument();
    });

    it("filters out non-pending invites", () => {
      const mixedInvites = [
        ...mockInvites.slice(0, 1),
        { ...mockInvites[1], status: "ACCEPTED" as const },
      ];

      render(<PendingInvitesList {...defaultProps} invites={mixedInvites} />);

      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.queryByText("bob@example.com")).not.toBeInTheDocument();
    });
  });

  describe("Revoke Functionality", () => {
    it("calls API when revoking invite", async () => {
      const user = userEvent.setup();
      const onRevoke = vi.fn();
      render(<PendingInvitesList {...defaultProps} onRevoke={onRevoke} />);

      // Click revoke button for first invite
      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      await user.click(revokeButtons[0]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/org/org-123/invite?inviteId=invite-1",
          { method: "DELETE" },
        );
      });

      await waitFor(() => {
        expect(onRevoke).toHaveBeenCalledWith("invite-1");
      });
    });
  });

  describe("Time Formatting", () => {
    it('shows "Today" for invites sent today', () => {
      const todayInvite = {
        ...mockInvites[0],
        createdAt: new Date().toISOString(),
      };

      render(<PendingInvitesList {...defaultProps} invites={[todayInvite]} />);

      expect(screen.getByText(/invited today/i)).toBeInTheDocument();
    });
  });
});
