/**
 * Chat Panel Component
 *
 * A collapsible sidebar for free-form follow-up questions.
 * Separate from the main report display.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.6
 * @see docs/DESIGN.md - Two-panel UX
 */

'use client';

import * as React from 'react';
import { 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  Loader2,
  X,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownDisplay } from '@/components/chat/markdown-display';

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  /** If this message resulted in a report update */
  incorporatedVersion?: number;
}

/**
 * Props for the ChatPanel component
 */
export interface ChatPanelProps {
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Whether a message is being sent */
  isSending?: boolean;
  /** Callback to send a new message */
  onSendMessage?: (content: string) => Promise<void>;
  /** Callback to request incorporating chat into report */
  onIncorporateIntoReport?: () => Promise<void>;
  /** Whether the panel is collapsed */
  isCollapsed?: boolean;
  /** Callback when panel collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Report version (for incorporated messages) */
  currentReportVersion?: number;
  /** Additional CSS classes */
  className?: string;
  /** Width when expanded */
  expandedWidth?: string;
}

/**
 * Single chat message component
 */
function ChatMessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2 p-3 rounded-lg',
        isUser ? 'bg-primary/5' : 'bg-muted/50'
      )}
      data-testid={`chat-message-${message.role}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">
            {isUser ? 'You' : 'Agent'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTime(message.timestamp)}
          </span>
        </div>
        
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownDisplay content={message.content} className="text-sm" />
        )}
        
        {message.incorporatedVersion && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            Incorporated into v{message.incorporatedVersion}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * ChatPanel Component
 *
 * Collapsible sidebar for chat-based follow-up questions.
 */
export function ChatPanel({
  messages,
  isSending = false,
  onSendMessage,
  onIncorporateIntoReport,
  isCollapsed: controlledCollapsed,
  onCollapseChange,
  currentReportVersion = 1,
  className,
  expandedWidth = 'w-80',
}: ChatPanelProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(true);
  const [inputValue, setInputValue] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  // Support both controlled and uncontrolled mode
  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapseChange ?? setInternalCollapsed;

  // Scroll to bottom when new messages arrive
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSend = React.useCallback(async () => {
    if (!inputValue.trim() || !onSendMessage || isSending) return;
    
    const content = inputValue.trim();
    setInputValue('');
    
    try {
      await onSendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input on error
      setInputValue(content);
    }
  }, [inputValue, onSendMessage, isSending]);

  // Handle keyboard shortcut
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Toggle panel
  const togglePanel = React.useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  return (
    <div
      className={cn(
        'flex flex-col border-l bg-background transition-all duration-200',
        isCollapsed ? 'w-12' : expandedWidth,
        className
      )}
      data-testid="chat-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium text-sm">Chat</span>
            <span className="text-xs text-muted-foreground">
              ({messages.length})
            </span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={togglePanel}
          aria-label={isCollapsed ? 'Expand chat' : 'Collapse chat'}
        >
          {isCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Collapsed state - vertical icon */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={togglePanel}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground mt-1">
              {messages.length}
            </span>
          )}
        </div>
      )}

      {/* Expanded content */}
      {!isCollapsed && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 ? (
              <div className="text-center py-8" data-testid="chat-empty">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Ask clarifying questions about the report
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Incorporate button */}
          {messages.length > 0 && onIncorporateIntoReport && (
            <div className="px-3 pb-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={onIncorporateIntoReport}
                disabled={isSending}
              >
                <Check className="h-4 w-4" />
                Incorporate into Report
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t">
            <div className="space-y-2">
              <Textarea
                placeholder="Ask a follow-up question..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="resize-none text-sm"
                disabled={isSending}
                data-testid="chat-input"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  ⌘ + Enter to send
                </span>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
