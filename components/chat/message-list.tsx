/**
 * Message List Component
 *
 * Displays conversation history between user and agent.
 * Supports both user messages and agent responses with
 * proper styling and accessibility.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.3
 * @see docs/DESIGN.md - Chat/Document Display
 */

'use client';

import * as React from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownDisplay, MarkdownDisplaySkeleton } from './markdown-display';

/**
 * Message types
 */
export type MessageRole = 'user' | 'agent' | 'system';

/**
 * Message interface
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: Date;
  metadata?: {
    tokenCount?: number;
    modelVersion?: string;
    processingTime?: number;
  };
}

/**
 * Props for the MessageList component
 */
export interface MessageListProps {
  /** Array of messages to display */
  messages: Message[];
  /** Whether a response is currently loading */
  isLoading?: boolean;
  /** Loading message text */
  loadingText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when a message is selected for follow-up */
  onMessageSelect?: (message: Message, selectedText: string) => void;
}

/**
 * Single message component
 */
function MessageItem({
  message,
  onSelect,
}: {
  message: Message;
  onSelect?: (selectedText: string) => void;
}) {
  const handleMouseUp = React.useCallback(() => {
    if (!onSelect) return;
    
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    
    if (selectedText && selectedText.length > 0) {
      onSelect(selectedText);
    }
  }, [onSelect]);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser && 'bg-primary/5',
        !isUser && !isSystem && 'bg-muted/50',
        isSystem && 'bg-yellow-500/5 border border-yellow-500/20'
      )}
      data-testid={`message-${message.role}`}
      onMouseUp={handleMouseUp}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser && 'bg-primary text-primary-foreground',
          !isUser && !isSystem && 'bg-secondary text-secondary-foreground',
          isSystem && 'bg-yellow-500/20 text-yellow-600'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Role label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {isUser ? 'You' : isSystem ? 'System' : 'Expert Agent'}
          </span>
          {message.timestamp && (
            <span className="text-xs text-muted-foreground">
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>

        {/* Message content */}
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <MarkdownDisplay
            content={message.content}
            className="text-sm"
            testId={`message-content-${message.id}`}
          />
        )}

        {/* Metadata */}
        {message.metadata && !isUser && (
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            {message.metadata.tokenCount && (
              <span>{message.metadata.tokenCount} tokens</span>
            )}
            {message.metadata.processingTime && (
              <span>{(message.metadata.processingTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Loading indicator component
 */
function LoadingIndicator({ text = 'Thinking...' }: { text?: string }) {
  return (
    <div
      className="flex gap-3 p-4 rounded-lg bg-muted/50"
      data-testid="message-loading"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground">
        <Bot className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">Expert Agent</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{text}</span>
        </div>
        <MarkdownDisplaySkeleton className="mt-3" />
      </div>
    </div>
  );
}

/**
 * Format timestamp to readable time
 */
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than a minute ago
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than an hour ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Same day
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Different day
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * MessageList Component
 *
 * Displays a conversation thread between user and agent.
 */
export function MessageList({
  messages,
  isLoading = false,
  loadingText = 'Analyzing your request...',
  className,
  onMessageSelect,
}: MessageListProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleMessageSelect = React.useCallback(
    (message: Message) => (selectedText: string) => {
      onMessageSelect?.(message, selectedText);
    },
    [onMessageSelect]
  );

  if (messages.length === 0 && !isLoading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
        data-testid="message-list-empty"
      >
        <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">Start a conversation</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Ask a question or submit your documents for analysis. The expert agent
          will provide detailed, structured responses.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="message-list">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onSelect={
            message.role === 'agent' ? handleMessageSelect(message) : undefined
          }
        />
      ))}

      {isLoading && <LoadingIndicator text={loadingText} />}

      <div ref={messagesEndRef} />
    </div>
  );
}
