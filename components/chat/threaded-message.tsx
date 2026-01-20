/**
 * Threaded Message Component
 *
 * Displays follow-up Q&A in a threaded/nested view with proper indentation
 * and visual hierarchy to show conversation flow.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.4 Highlight & Comment
 */

"use client";

import * as React from "react";
import { MessageSquare, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MarkdownDisplay } from "@/components/chat/markdown-display";

/**
 * Extended message interface with threading support
 */
export interface ThreadedMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  /** Parent message ID for threading */
  parentId?: string;
  /** Quoted text that this message is responding to */
  quotedText?: string;
  /** Thread depth for visual indentation */
  depth?: number;
  /** Whether this message is a follow-up to highlighted text */
  isFollowUp?: boolean;
}

/**
 * Props for ThreadedMessageView
 */
export interface ThreadedMessageViewProps {
  /** The message to display */
  message: ThreadedMessage;
  /** Child replies */
  replies?: ThreadedMessage[];
  /** Whether to show the thread collapsed */
  defaultCollapsed?: boolean;
  /** Callback when user wants to reply */
  onReply?: (message: ThreadedMessage) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Format relative time for display
 */
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Quoted text display component
 */
function QuotedText({ text }: { text: string }) {
  return (
    <div
      className="border-l-2 border-primary/50 pl-3 py-1 mb-2 text-sm text-muted-foreground italic"
      data-testid="quoted-text"
    >
      <span className="line-clamp-2">&ldquo;{text}&rdquo;</span>
    </div>
  );
}

/**
 * Single threaded message component
 */
function ThreadedMessageItem({
  message,
  getReplies,
  onReply,
}: {
  message: ThreadedMessage;
  getReplies: (id: string) => ThreadedMessage[];
  onReply?: (message: ThreadedMessage) => void;
}) {
  const replies = getReplies(message.id);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const hasReplies = replies.length > 0;
  const isUser = message.role === "user";
  const depth = message.depth ?? 0;

  return (
    <div
      className={cn(
        "relative",
        depth > 0 && "ml-4 pl-4 border-l-2 border-muted",
      )}
      data-testid={`threaded-message-${message.id}`}
      data-depth={depth}
    >
      {/* Thread connector line */}
      {depth > 0 && (
        <div className="absolute left-0 top-0 w-4 h-4 border-b-2 border-muted -ml-px" />
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col gap-1 p-3 rounded-lg",
          isUser ? "bg-primary/5" : "bg-muted/50",
          message.isFollowUp && "ring-1 ring-primary/20",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            {isUser ? "You" : "Agent"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
          {message.isFollowUp && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Reply className="h-3 w-3" />
              Follow-up
            </span>
          )}
        </div>

        {/* Quoted text if present */}
        {message.quotedText && <QuotedText text={message.quotedText} />}

        {/* Message body */}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownDisplay content={message.content} className="text-sm" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          {onReply && message.role === "agent" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => onReply(message)}
            >
              <Reply className="h-3 w-3" />
              Reply
            </Button>
          )}
          {hasReplies && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide {replies.length}{" "}
                  {replies.length === 1 ? "reply" : "replies"}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show {replies.length}{" "}
                  {replies.length === 1 ? "reply" : "replies"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Nested replies */}
      {hasReplies && isExpanded && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <ThreadedMessageItem
              key={reply.id}
              message={{ ...reply, depth: depth + 1 }}
              getReplies={getReplies}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Props for ThreadedConversation
 */
export interface ThreadedConversationProps {
  /** All messages in the conversation */
  messages: ThreadedMessage[];
  /** Callback when user wants to reply to a message */
  onReply?: (message: ThreadedMessage) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Build threaded message tree from flat list
 */
function buildThreadTree(
  messages: ThreadedMessage[],
): Map<string | undefined, ThreadedMessage[]> {
  const tree = new Map<string | undefined, ThreadedMessage[]>();

  for (const msg of messages) {
    const parentId = msg.parentId;
    if (!tree.has(parentId)) {
      tree.set(parentId, []);
    }
    tree.get(parentId)!.push(msg);
  }

  return tree;
}

/**
 * ThreadedConversation Component
 *
 * Renders a list of messages with proper threading and nesting.
 */
export function ThreadedConversation({
  messages,
  onReply,
  className,
}: ThreadedConversationProps) {
  // Build tree structure
  const tree = React.useMemo(() => buildThreadTree(messages), [messages]);

  // Get root messages (no parent)
  const rootMessages = tree.get(undefined) ?? [];

  if (messages.length === 0) {
    return (
      <div
        className={cn("text-center py-8", className)}
        data-testid="thread-empty"
      >
        <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No messages yet</p>
      </div>
    );
  }

  // Get replies for a message
  const getReplies = (messageId: string): ThreadedMessage[] => {
    return tree.get(messageId) ?? [];
  };

  return (
    <div
      className={cn("space-y-3", className)}
      data-testid="threaded-conversation"
    >
      {rootMessages.map((message) => (
        <ThreadedMessageItem
          key={message.id}
          message={message}
          getReplies={getReplies}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

/**
 * Hook for managing threaded conversation state
 */
export function useThreadedConversation(
  initialMessages: ThreadedMessage[] = [],
) {
  const [messages, setMessages] =
    React.useState<ThreadedMessage[]>(initialMessages);

  const addMessage = React.useCallback(
    (message: Omit<ThreadedMessage, "id" | "timestamp">) => {
      const newMessage: ThreadedMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    [],
  );

  const addReply = React.useCallback(
    (
      parentId: string,
      content: string,
      role: "user" | "agent",
      quotedText?: string,
    ) => {
      return addMessage({
        content,
        role,
        parentId,
        quotedText,
        isFollowUp: true,
      });
    },
    [addMessage],
  );

  const getThread = React.useCallback(
    (messageId: string): ThreadedMessage[] => {
      const thread: ThreadedMessage[] = [];
      let currentId: string | undefined = messageId;

      while (currentId) {
        const message = messages.find((m) => m.id === currentId);
        if (message) {
          thread.unshift(message);
          currentId = message.parentId;
        } else {
          break;
        }
      }

      return thread;
    },
    [messages],
  );

  return {
    messages,
    addMessage,
    addReply,
    getThread,
    messageCount: messages.length,
  };
}
