/**
 * MembersTab Component Tests
 *
 * Tests for the MembersTab client component that integrates
 * InviteForm, TeamMembersList, and PendingInvitesList.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MembersTab } from "../members-tab";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: "user-123", email: "test@example.com", name: "Test User" },
    },
    status: "authenticated",
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock workspace context
const mockUseWorkspace = vi.fn();
vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MembersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("shows message when no org is selected", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: null,
      activeOrg: null,
      organizations: [],
      isLoading: false,
    });

    render(<MembersTab />);

    expect(screen.getByText(/select an organization/i)).toBeInTheDocument();
  });

  it("shows loading state initially", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "OWNER" },
      organizations: [{ id: "org-123", name: "Test Org", role: "OWNER" }],
      isLoading: false,
    });

    // Don't resolve fetch immediately
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<MembersTab />);

    // Should show loading spinner
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  it("shows invite form for owner/admin", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "owner" },
      organizations: [{ id: "org-123", name: "Test Org", role: "owner" }],
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [], invites: [] }),
    });

    render(<MembersTab />);

    await waitFor(() => {
      expect(screen.getByText(/invite team members/i)).toBeInTheDocument();
    });
  });

  it("hides invite form for regular members", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "member" },
      organizations: [{ id: "org-123", name: "Test Org", role: "member" }],
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [], invites: [] }),
    });

    render(<MembersTab />);

    // Wait for loading to complete - check for "No team members" (empty state)
    await waitFor(() => {
      expect(screen.getByText(/no team members/i)).toBeInTheDocument();
    });

    // Invite section should not be visible for regular members
    expect(screen.queryByText(/invite team members/i)).not.toBeInTheDocument();
  });

  it("displays members list after loading", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "owner" },
      organizations: [{ id: "org-123", name: "Test Org", role: "owner" }],
      isLoading: false,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/members")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              members: [
                {
                  id: "m1",
                  userId: "u1",
                  role: "OWNER",
                  user: {
                    id: "u1",
                    name: "John Doe",
                    email: "john@example.com",
                    image: null,
                  },
                },
              ],
            }),
        });
      }
      if (url.includes("/invite")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invites: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<MembersTab />);

    await waitFor(() => {
      expect(
        screen.getByText("1 member in your organization"),
      ).toBeInTheDocument();
    });
  });

  it("displays pending invites section when invites exist", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "owner" },
      organizations: [{ id: "org-123", name: "Test Org", role: "owner" }],
      isLoading: false,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/members")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ members: [] }),
        });
      }
      if (url.includes("/invite")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              invites: [
                {
                  id: "inv1",
                  email: "pending@example.com",
                  role: "MEMBER",
                  status: "PENDING",
                  createdAt: new Date().toISOString(),
                  expiresAt: new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<MembersTab />);

    await waitFor(() => {
      expect(screen.getByText(/pending invitations/i)).toBeInTheDocument();
    });
  });

  it("hides pending invites section when no invites", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "org-123",
      activeOrg: { id: "org-123", name: "Test Org", role: "owner" },
      organizations: [{ id: "org-123", name: "Test Org", role: "owner" }],
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [], invites: [] }),
    });

    render(<MembersTab />);

    // Wait for loading to complete - "No team members" appears in empty state
    await waitFor(() => {
      expect(screen.getByText(/no team members/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/pending invitations/i)).not.toBeInTheDocument();
  });

  it("fetches data from correct API endpoints", async () => {
    mockUseWorkspace.mockReturnValue({
      activeOrgId: "test-org-id",
      activeOrg: { id: "test-org-id", name: "Test Org", role: "owner" },
      organizations: [{ id: "test-org-id", name: "Test Org", role: "owner" }],
      isLoading: false,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [], invites: [] }),
    });

    render(<MembersTab />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/org/test-org-id/members");
      expect(mockFetch).toHaveBeenCalledWith("/api/org/test-org-id/invite");
    });
  });
});
