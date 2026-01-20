/**
 * Threaded Message Component Tests
 *
 * Tests for threaded Q&A display including:
 * - Message rendering
 * - Threading/nesting
 * - Quoted text
 * - Reply actions
 * - Hook functionality
 *
 * @see docs/IMPEMENTATION.md - Phase 4.4 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ThreadedConversation,
  useThreadedConversation,
  ThreadedMessage,
} from "../threaded-message";
import { renderHook, act } from "@testing-library/react";

describe("ThreadedConversation", () => {
  // Sample messages
  const mockMessages: ThreadedMessage[] = [
    {
      id: "msg-1",
      role: "user",
      content: "What does this section mean?",
      timestamp: new Date(),
    },
    {
      id: "msg-2",
      role: "agent",
      content: "This section explains the **key concepts**.",
      timestamp: new Date(),
    },
    {
      id: "msg-3",
      role: "user",
      content: "Can you elaborate on concept A?",
      timestamp: new Date(),
      parentId: "msg-2",
      quotedText: "key concepts",
      isFollowUp: true,
    },
    {
      id: "msg-4",
      role: "agent",
      content: "Concept A refers to the foundational principles.",
      timestamp: new Date(),
      parentId: "msg-3",
      isFollowUp: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders messages", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      expect(screen.getByTestId("threaded-conversation")).toBeInTheDocument();
    });

    it("shows empty state when no messages", () => {
      render(<ThreadedConversation messages={[]} />);

      expect(screen.getByTestId("thread-empty")).toBeInTheDocument();
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });

    it("renders root messages", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      expect(screen.getByTestId("threaded-message-msg-1")).toBeInTheDocument();
      expect(screen.getByTestId("threaded-message-msg-2")).toBeInTheDocument();
    });

    it("shows user role label", () => {
      const userMessage: ThreadedMessage[] = [
        { id: "u1", role: "user", content: "Test", timestamp: new Date() },
      ];

      render(<ThreadedConversation messages={userMessage} />);

      expect(screen.getByText("You")).toBeInTheDocument();
    });

    it("shows agent role label", () => {
      const agentMessage: ThreadedMessage[] = [
        { id: "a1", role: "agent", content: "Response", timestamp: new Date() },
      ];

      render(<ThreadedConversation messages={agentMessage} />);

      expect(screen.getByText("Agent")).toBeInTheDocument();
    });
  });

  describe("Threading", () => {
    it("nests replies under parent messages", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      // msg-3 should be nested as a reply to msg-2
      const reply = screen.getByTestId("threaded-message-msg-3");
      expect(reply).toHaveAttribute("data-depth", "1");
    });

    it("shows nested replies with increased depth", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      // msg-4 is a reply to msg-3, which is a reply to msg-2
      const nestedReply = screen.getByTestId("threaded-message-msg-4");
      expect(nestedReply).toHaveAttribute("data-depth", "2");
    });
  });

  describe("Quoted Text", () => {
    it("displays quoted text when present", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      expect(screen.getByTestId("quoted-text")).toBeInTheDocument();
    });

    it("hides quoted text section when not present", () => {
      const messagesWithoutQuotes = mockMessages.filter((m) => !m.quotedText);
      render(<ThreadedConversation messages={messagesWithoutQuotes} />);

      expect(screen.queryByTestId("quoted-text")).not.toBeInTheDocument();
    });
  });

  describe("Follow-up Indicator", () => {
    it("shows follow-up badge on follow-up messages", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      // msg-3 is marked as a follow-up
      expect(screen.getAllByText("Follow-up").length).toBeGreaterThan(0);
    });
  });

  describe("Reply Action", () => {
    it("shows reply button on agent messages", async () => {
      const onReply = vi.fn();
      render(
        <ThreadedConversation messages={mockMessages} onReply={onReply} />,
      );

      // Find reply buttons
      const replyButtons = screen.getAllByRole("button", { name: /reply/i });
      expect(replyButtons.length).toBeGreaterThan(0);
    });

    it("calls onReply with message when reply clicked", async () => {
      const user = userEvent.setup();
      const onReply = vi.fn();

      const simpleMessages: ThreadedMessage[] = [
        { id: "a1", role: "agent", content: "Response", timestamp: new Date() },
      ];

      render(
        <ThreadedConversation messages={simpleMessages} onReply={onReply} />,
      );

      const replyButton = screen.getByRole("button", { name: /reply/i });
      await user.click(replyButton);

      expect(onReply).toHaveBeenCalledWith(
        expect.objectContaining({ id: "a1", role: "agent" }),
      );
    });
  });

  describe("Thread Collapse", () => {
    it("shows collapse button when message has replies", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      // msg-2 has replies, so should show at least one collapse button
      const hideButtons = screen.getAllByRole("button", {
        name: /hide.*repl/i,
      });
      expect(hideButtons.length).toBeGreaterThan(0);
    });

    it("toggles visibility when collapse clicked", async () => {
      const user = userEvent.setup();
      render(<ThreadedConversation messages={mockMessages} />);

      // Initially expanded
      expect(screen.getByTestId("threaded-message-msg-3")).toBeInTheDocument();

      // Click first hide button
      const hideButtons = screen.getAllByRole("button", {
        name: /hide.*repl/i,
      });
      await user.click(hideButtons[0]);

      // Should show "Show" now
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /show.*repl/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper test IDs", () => {
      render(<ThreadedConversation messages={mockMessages} />);

      expect(screen.getByTestId("threaded-conversation")).toBeInTheDocument();
      expect(screen.getByTestId("threaded-message-msg-1")).toBeInTheDocument();
    });
  });
});

describe("useThreadedConversation", () => {
  it("initializes with empty messages", () => {
    const { result } = renderHook(() => useThreadedConversation());

    expect(result.current.messages).toEqual([]);
    expect(result.current.messageCount).toBe(0);
  });

  it("initializes with provided messages", () => {
    const initial: ThreadedMessage[] = [
      { id: "m1", role: "user", content: "Test", timestamp: new Date() },
    ];
    const { result } = renderHook(() => useThreadedConversation(initial));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messageCount).toBe(1);
  });

  it("adds new message", () => {
    const { result } = renderHook(() => useThreadedConversation());

    act(() => {
      result.current.addMessage({ content: "Hello", role: "user" });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Hello");
    expect(result.current.messages[0].id).toBeDefined();
  });

  it("adds reply with parent ID", () => {
    const initial: ThreadedMessage[] = [
      {
        id: "parent-1",
        role: "agent",
        content: "Initial",
        timestamp: new Date(),
      },
    ];
    const { result } = renderHook(() => useThreadedConversation(initial));

    act(() => {
      result.current.addReply("parent-1", "Follow-up", "user", "Initial");
    });

    expect(result.current.messages).toHaveLength(2);
    const reply = result.current.messages[1];
    expect(reply.parentId).toBe("parent-1");
    expect(reply.quotedText).toBe("Initial");
    expect(reply.isFollowUp).toBe(true);
  });

  it("gets thread chain for message", () => {
    const messages: ThreadedMessage[] = [
      { id: "m1", role: "user", content: "Q1", timestamp: new Date() },
      {
        id: "m2",
        role: "agent",
        content: "A1",
        timestamp: new Date(),
        parentId: "m1",
      },
      {
        id: "m3",
        role: "user",
        content: "Q2",
        timestamp: new Date(),
        parentId: "m2",
      },
    ];
    const { result } = renderHook(() => useThreadedConversation(messages));

    const thread = result.current.getThread("m3");

    expect(thread).toHaveLength(3);
    expect(thread[0].id).toBe("m1");
    expect(thread[1].id).toBe("m2");
    expect(thread[2].id).toBe("m3");
  });
});
