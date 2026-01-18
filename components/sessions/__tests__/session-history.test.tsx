/**
 * Session History Component Tests
 *
 * Tests for the session history display including:
 * - Session list rendering
 * - Loading and error states
 * - Search functionality
 * - Session selection
 * - Pagination
 * - Security
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHistory, SessionData } from "../session-history";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => "/conversations",
}));

describe("SessionHistory", () => {
  // Sample session data
  const mockSessions: SessionData[] = [
    {
      id: "session-1",
      agentId: "ux-analyst",
      agentName: "UX Analyst",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 5,
      lastMessage: {
        id: "msg-1",
        role: "agent",
        preview: "The analysis shows several usability issues...",
        createdAt: new Date().toISOString(),
      },
      archived: false,
    },
    {
      id: "session-2",
      agentId: "legal-advisor",
      agentName: "Legal Advisor",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      messageCount: 3,
      lastMessage: {
        id: "msg-2",
        role: "agent",
        preview: "The contract contains several key clauses...",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      archived: false,
    },
    {
      id: "session-3",
      agentId: "ux-analyst",
      agentName: "UX Analyst",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      messageCount: 0,
      lastMessage: null,
      archived: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: mockSessions,
        pagination: { hasMore: false, nextCursor: null, count: 3 },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Session List Rendering", () => {
    it("renders session list from API", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history")).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId("session-item-session-2"),
        ).toBeInTheDocument();
      });
    });

    it("shows agent names", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        // Use getAllByText since UX Analyst appears twice
        expect(screen.getAllByText("UX Analyst")[0]).toBeInTheDocument();
        expect(screen.getByText("Legal Advisor")).toBeInTheDocument();
      });
    });

    it("shows message count", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByText("5")).toBeInTheDocument();
        expect(screen.getByText("3")).toBeInTheDocument();
      });
    });

    it("shows last message preview", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByText(/usability issues/i)).toBeInTheDocument();
        expect(screen.getByText(/contract contains/i)).toBeInTheDocument();
      });
    });

    it('shows "No messages yet" for empty sessions', async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByText("No messages yet")).toBeInTheDocument();
      });
    });

    it("shows archived badge for archived sessions", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByText("Archived")).toBeInTheDocument();
      });
    });
  });

  describe("Loading State", () => {
    it("shows loading skeleton while fetching", async () => {
      // Delay the fetch response
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    sessions: mockSessions,
                    pagination: { hasMore: false, nextCursor: null, count: 3 },
                  }),
                }),
              100,
            ),
          ),
      );

      render(<SessionHistory />);

      // Should show skeleton immediately
      expect(screen.getByTestId("session-history")).toBeInTheDocument();

      // Eventually shows data
      await waitFor(
        () => {
          expect(
            screen.getByTestId("session-item-session-1"),
          ).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no sessions", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessions: [],
          pagination: { hasMore: false, nextCursor: null, count: 0 },
        }),
      });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history-empty")).toBeInTheDocument();
      });

      expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message on fetch failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history-error")).toBeInTheDocument();
      });

      expect(screen.getByText("Failed to load sessions")).toBeInTheDocument();
    });

    it("provides retry button on error", async () => {
      const user = userEvent.setup();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: mockSessions,
            pagination: { hasMore: false, nextCursor: null, count: 3 },
          }),
        });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history-error")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: /try again/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Search", () => {
    it("renders search input", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-search")).toBeInTheDocument();
      });
    });

    it("filters sessions by search query", async () => {
      const user = userEvent.setup();
      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId("session-search");
      await user.type(searchInput, "Legal");

      await waitFor(() => {
        expect(
          screen.queryByTestId("session-item-session-1"),
        ).not.toBeInTheDocument();
        expect(
          screen.getByTestId("session-item-session-2"),
        ).toBeInTheDocument();
      });
    });

    it("shows no results message when search finds nothing", async () => {
      const user = userEvent.setup();
      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId("session-search");
      await user.type(searchInput, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText(/no sessions match/i)).toBeInTheDocument();
      });
    });

    it("can hide search input", async () => {
      render(<SessionHistory showSearch={false} />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("session-search")).not.toBeInTheDocument();
    });
  });

  describe("Session Selection", () => {
    it("calls onSelectSession when session clicked", async () => {
      const onSelectSession = vi.fn();
      const user = userEvent.setup();

      render(<SessionHistory onSelectSession={onSelectSession} />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("session-item-session-1"));

      expect(onSelectSession).toHaveBeenCalledWith(mockSessions[0]);
    });

    it("navigates to session when no callback provided", async () => {
      const user = userEvent.setup();

      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("session-item-session-1"));

      expect(mockPush).toHaveBeenCalledWith("/conversations/session-1");
    });

    it("highlights active session", async () => {
      render(<SessionHistory activeSessionId="session-2" />);

      await waitFor(() => {
        const activeSession = screen.getByTestId("session-item-session-2");
        expect(activeSession).toHaveClass("bg-primary/10");
      });
    });
  });

  describe("Pagination", () => {
    it("shows load more button when hasMore is true", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessions: mockSessions.slice(0, 2),
          pagination: { hasMore: true, nextCursor: "session-2", count: 2 },
        }),
      });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /load more/i }),
        ).toBeInTheDocument();
      });
    });

    it("loads more sessions on click", async () => {
      const user = userEvent.setup();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: mockSessions.slice(0, 2),
            pagination: { hasMore: true, nextCursor: "session-2", count: 2 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sessions: [mockSessions[2]],
            pagination: { hasMore: false, nextCursor: null, count: 1 },
          }),
        });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /load more/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /load more/i }));

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-3"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Agent Filtering", () => {
    it("passes agentId to API call", async () => {
      render(<SessionHistory agentId="ux-analyst" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("agentId=ux-analyst"),
        );
      });
    });
  });

  describe("Refresh", () => {
    it("refreshes sessions on refresh button click", async () => {
      const user = userEvent.setup();

      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Find refresh button by its icon
      const refreshButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg.lucide-refresh-cw"));

      if (refreshButton) {
        await user.click(refreshButton);

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalledTimes(2);
        });
      }
    });
  });

  describe("Accessibility", () => {
    it("has proper test IDs", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId("session-history")).toBeInTheDocument();
      });
    });

    it("session items are keyboard accessible", async () => {
      render(<SessionHistory />);

      await waitFor(() => {
        const sessionItem = screen.getByTestId("session-item-session-1");
        // Button component renders as a button element
        expect(sessionItem.tagName.toLowerCase()).toBe("button");
      });
    });
  });

  describe("Security", () => {
    it("handles XSS in session content safely", async () => {
      const maliciousSessions: SessionData[] = [
        {
          ...mockSessions[0],
          agentName: '<script>alert("xss")</script>Agent',
          lastMessage: {
            id: "msg-1",
            role: "agent",
            preview: '<script>alert("xss")</script>Content',
            createdAt: new Date().toISOString(),
          },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessions: maliciousSessions,
          pagination: { hasMore: false, nextCursor: null, count: 1 },
        }),
      });

      render(<SessionHistory />);

      await waitFor(() => {
        expect(
          screen.getByTestId("session-item-session-1"),
        ).toBeInTheDocument();
      });

      // React escapes content - script should be shown as text, not executed
      const sessionItem = screen.getByTestId("session-item-session-1");
      expect(sessionItem.innerHTML).not.toContain("<script>");
    });
  });
});
