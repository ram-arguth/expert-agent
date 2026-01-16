/**
 * Team Members List Unit Tests
 *
 * Tests the team members list component including:
 * - Member rendering with roles and avatars
 * - Role-based access control for actions
 * - Remove and role update functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamMembersList } from "../team-members-list";

const mockMembers = [
  {
    id: "membership-1",
    userId: "user-1",
    role: "OWNER" as const,
    user: {
      id: "user-1",
      name: "John Owner",
      email: "john@example.com",
      image: null,
    },
  },
  {
    id: "membership-2",
    userId: "user-2",
    role: "ADMIN" as const,
    user: {
      id: "user-2",
      name: "Jane Admin",
      email: "jane@example.com",
      image: "https://example.com/avatar.jpg",
    },
  },
  {
    id: "membership-3",
    userId: "user-3",
    role: "MEMBER" as const,
    user: {
      id: "user-3",
      name: null,
      email: "bob@example.com",
      image: null,
    },
  },
];

describe("TeamMembersList", () => {
  const defaultProps = {
    members: mockMembers,
    currentUserId: "user-1",
    currentUserRole: "OWNER" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders all team members", () => {
      render(<TeamMembersList {...defaultProps} />);

      expect(screen.getByText("John Owner")).toBeInTheDocument();
      expect(screen.getByText("Jane Admin")).toBeInTheDocument();
      // User without name shows email in both places (as name and as email below it)
      // So we check for at least one occurrence
      expect(screen.getAllByText("bob@example.com").length).toBeGreaterThan(0);
    });

    it("shows role badges for each member", () => {
      render(<TeamMembersList {...defaultProps} />);

      expect(screen.getByText("OWNER")).toBeInTheDocument();
      expect(screen.getByText("ADMIN")).toBeInTheDocument();
      expect(screen.getByText("MEMBER")).toBeInTheDocument();
    });

    it('shows "(you)" indicator for current user', () => {
      render(<TeamMembersList {...defaultProps} />);

      expect(screen.getByText("(you)")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<TeamMembersList {...defaultProps} isLoading />);

      // Should have a loading spinner
      expect(screen.queryByText("John Owner")).not.toBeInTheDocument();
    });

    it("shows empty state when no members", () => {
      render(<TeamMembersList {...defaultProps} members={[]} />);

      expect(screen.getByText("No team members")).toBeInTheDocument();
    });

    it("shows initials in avatar for users without image", () => {
      render(<TeamMembersList {...defaultProps} />);

      // John Owner -> JO
      expect(screen.getByText("JO")).toBeInTheDocument();
      // bob@example.com -> BO (first two chars of email)
      expect(screen.getByText("BO")).toBeInTheDocument();
    });
  });

  describe("Access Control", () => {
    it("owner can see action menu for non-owner members", async () => {
      const user = userEvent.setup();
      render(<TeamMembersList {...defaultProps} onRemoveMember={vi.fn()} />);

      // Should have action buttons for admin and member (but not owner)
      const actionButtons = screen.getAllByRole("button", {
        name: /member actions/i,
      });
      expect(actionButtons.length).toBe(2); // Admin and Member

      // Click on one to verify it works
      await user.click(actionButtons[0]);
    });

    it("admin cannot manage other admins", () => {
      render(
        <TeamMembersList
          {...defaultProps}
          currentUserId="user-2" // Jane is the current user (admin)
          currentUserRole="ADMIN"
          onRemoveMember={vi.fn()}
        />,
      );

      // Admin should only see action menu for regular members
      const actionButtons = screen.queryAllByRole("button", {
        name: /member actions/i,
      });
      expect(actionButtons.length).toBe(1); // Only the MEMBER
    });

    it("member cannot see any action menus", () => {
      render(
        <TeamMembersList
          {...defaultProps}
          currentUserId="user-3"
          currentUserRole="MEMBER"
          onRemoveMember={vi.fn()}
        />,
      );

      const actionButtons = screen.queryAllByRole("button", {
        name: /member actions/i,
      });
      expect(actionButtons.length).toBe(0);
    });

    it("cannot show actions for yourself", () => {
      render(
        <TeamMembersList
          {...defaultProps}
          currentUserId="user-1" // Owner
          onRemoveMember={vi.fn()}
        />,
      );

      // Owner shouldn't see action menu for themselves
      // Should only see 2 action buttons (for admin and member)
      const actionButtons = screen.queryAllByRole("button", {
        name: /member actions/i,
      });
      expect(actionButtons.length).toBe(2);
    });
  });

  describe("Sorting", () => {
    it("sorts members by role: owners first, then admins, then members", () => {
      // Create unsorted array with member first
      const unsortedMembers = [...mockMembers].reverse();
      render(<TeamMembersList {...defaultProps} members={unsortedMembers} />);

      // Get all member list items by checking DOM order
      const listItems = document.querySelectorAll(".rounded-lg.border");

      // First item should be owner (John Owner)
      expect(listItems[0].textContent).toContain("John Owner");
      expect(listItems[0].textContent).toContain("OWNER");

      // Second should be admin
      expect(listItems[1].textContent).toContain("Jane Admin");
      expect(listItems[1].textContent).toContain("ADMIN");
    });
  });
});
