/**
 * Invite Accept Page Tests
 *
 * Tests for the invite acceptance UI page.
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import InviteAcceptContent from "../page-content";

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParams,
  }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock next-auth
const mockSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockSession(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("InviteAcceptContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockFetch.mockReset();
  });

  it("shows loading state initially", async () => {
    mockSearchParams.mockReturnValue("test-token");
    mockSession.mockReturnValue({ data: null, status: "loading" });
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(<InviteAcceptContent />);

    expect(screen.getByText(/loading invitation/i)).toBeInTheDocument();
  });

  it("shows invalid state when no token provided", async () => {
    mockSearchParams.mockReturnValue(null);
    mockSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByText(/invalid invitation/i)).toBeInTheDocument();
    });
  });

  it("shows expired state for expired invite", async () => {
    mockSearchParams.mockReturnValue("expired-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: () => Promise.resolve({ message: "Invite has expired" }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByText(/invitation expired/i)).toBeInTheDocument();
    });
  });

  it("shows sign-in prompt when not authenticated", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({ data: null, status: "unauthenticated" });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "test@example.com",
          orgName: "Test Org",
          role: "MEMBER",
          invitedBy: "John Doe",
          isValid: true,
        }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByText(/sign in required/i)).toBeInTheDocument();
    });
  });

  it("shows invite details when valid and authenticated", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "test@example.com",
          orgName: "Acme Corp",
          role: "ADMIN",
          invitedBy: "Jane Smith",
          isValid: true,
        }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByText(/you're invited/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("shows email mismatch warning when emails differ", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "different@example.com" } },
      status: "authenticated",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "test@example.com",
          orgName: "Test Org",
          role: "MEMBER",
          invitedBy: "John Doe",
          isValid: true,
        }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByText(/email mismatch/i)).toBeInTheDocument();
    });
  });

  it("disables accept button when email does not match", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "different@example.com" } },
      status: "authenticated",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "test@example.com",
          orgName: "Test Org",
          role: "MEMBER",
          invitedBy: "John Doe",
          isValid: true,
        }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      const acceptButton = screen.getByRole("button", {
        name: /accept invitation/i,
      });
      expect(acceptButton).toBeDisabled();
    });
  });

  it("calls accept API when accept button clicked", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch
      // First call: GET invite info
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            email: "test@example.com",
            orgName: "Test Org",
            role: "MEMBER",
            invitedBy: "John Doe",
            isValid: true,
          }),
      })
      // Second call: POST accept
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Successfully joined",
            org: { name: "Test Org" },
          }),
      });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept invitation/i }),
      ).toBeEnabled();
    });

    const acceptButton = screen.getByRole("button", {
      name: /accept invitation/i,
    });
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/invite/accept",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "valid-token" }),
        }),
      );
    });
  });

  it("shows success state after accepting invite", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            email: "test@example.com",
            orgName: "Test Org",
            role: "MEMBER",
            invitedBy: "John Doe",
            isValid: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Successfully joined",
            org: { name: "Test Org" },
          }),
      });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept invitation/i }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/welcome to test org/i)).toBeInTheDocument();
    });
  });

  it("shows error when accept API fails", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            email: "test@example.com",
            orgName: "Test Org",
            role: "MEMBER",
            invitedBy: "John Doe",
            isValid: true,
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept invitation/i }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /accept invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it("navigates to dashboard when decline clicked", async () => {
    mockSearchParams.mockReturnValue("valid-token");
    mockSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          email: "test@example.com",
          orgName: "Test Org",
          role: "MEMBER",
          invitedBy: "John Doe",
          isValid: true,
        }),
    });

    render(<InviteAcceptContent />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /decline/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: /decline/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });
});
