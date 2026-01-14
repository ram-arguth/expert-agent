/**
 * Chat Panel Component Tests
 *
 * Tests for the collapsible chat sidebar including:
 * - Panel collapse/expand
 * - Message display
 * - Message sending
 * - Incorporate into report
 * - Keyboard navigation
 * - Accessibility
 * - Security
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel, ChatMessage } from '../chat-panel';

describe('ChatPanel', () => {
  // Sample messages
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'What does the first section mean?',
      timestamp: new Date(),
    },
    {
      id: 'msg-2',
      role: 'agent',
      content: 'The **first section** outlines the key terms...',
      timestamp: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Panel Collapse/Expand', () => {
    it('starts collapsed by default', () => {
      render(<ChatPanel messages={[]} />);
      
      const panel = screen.getByTestId('chat-panel');
      expect(panel).toHaveClass('w-12');
    });

    it('expands when toggle button clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel messages={[]} />);
      
      const expandButton = screen.getByRole('button', { name: /expand chat/i });
      await user.click(expandButton);
      
      const panel = screen.getByTestId('chat-panel');
      expect(panel).toHaveClass('w-80');
    });

    it('collapses when toggle button clicked while expanded', async () => {
      const user = userEvent.setup();
      render(<ChatPanel messages={[]} isCollapsed={false} />);
      
      const collapseButton = screen.getByRole('button', { name: /collapse chat/i });
      await user.click(collapseButton);
      
      // In controlled mode, this should call onCollapseChange
    });

    it('calls onCollapseChange in controlled mode', async () => {
      const user = userEvent.setup();
      const onCollapseChange = vi.fn();
      
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={true} 
          onCollapseChange={onCollapseChange} 
        />
      );
      
      const expandButton = screen.getByRole('button', { name: /expand chat/i });
      await user.click(expandButton);
      
      expect(onCollapseChange).toHaveBeenCalledWith(false);
    });

    it('shows message count badge when collapsed', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={true} />);
      
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Message Display', () => {
    it('renders user messages', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={false} />);
      
      expect(screen.getByTestId('chat-message-user')).toBeInTheDocument();
      expect(screen.getByText(/first section mean/i)).toBeInTheDocument();
    });

    it('renders agent messages with markdown', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={false} />);
      
      expect(screen.getByTestId('chat-message-agent')).toBeInTheDocument();
      // Markdown renders "first section" as bold
      expect(screen.getByText('first section')).toBeInTheDocument();
    });

    it('shows empty state when no messages', () => {
      render(<ChatPanel messages={[]} isCollapsed={false} />);
      
      expect(screen.getByTestId('chat-empty')).toBeInTheDocument();
      expect(screen.getByText(/ask clarifying questions/i)).toBeInTheDocument();
    });

    it('shows role labels for messages', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={false} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('shows incorporated version badge', () => {
      const messagesWithIncorporated: ChatMessage[] = [
        {
          ...mockMessages[1],
          incorporatedVersion: 3,
        },
      ];

      render(<ChatPanel messages={messagesWithIncorporated} isCollapsed={false} />);
      
      expect(screen.getByText(/incorporated into v3/i)).toBeInTheDocument();
    });
  });

  describe('Message Sending', () => {
    it('renders input textarea', () => {
      render(<ChatPanel messages={[]} isCollapsed={false} />);
      
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('disables send button when input is empty', () => {
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          onSendMessage={vi.fn()} 
        />
      );
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('enables send button when input has content', async () => {
      const user = userEvent.setup();
      
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          onSendMessage={vi.fn()} 
        />
      );
      
      const input = screen.getByTestId('chat-input');
      await user.type(input, 'Test message');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });

    it('calls onSendMessage when send clicked', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn().mockResolvedValue(undefined);
      
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          onSendMessage={onSendMessage} 
        />
      );
      
      const input = screen.getByTestId('chat-input');
      await user.type(input, 'Test question');
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('Test question');
      });
    });

    it('clears input after sending', async () => {
      const user = userEvent.setup();
      const onSendMessage = vi.fn().mockResolvedValue(undefined);
      
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          onSendMessage={onSendMessage} 
        />
      );
      
      const input = screen.getByTestId('chat-input');
      await user.type(input, 'Test question');
      await user.click(screen.getByRole('button', { name: /send/i }));
      
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('shows loading state while sending', async () => {
      const onSendMessage = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          onSendMessage={onSendMessage}
          isSending={true}
        />
      );
      
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });

    it('disables input while sending', () => {
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          isSending={true}
        />
      );
      
      expect(screen.getByTestId('chat-input')).toBeDisabled();
    });
  });

  describe('Incorporate into Report', () => {
    it('shows incorporate button when messages exist', () => {
      render(
        <ChatPanel 
          messages={mockMessages} 
          isCollapsed={false} 
          onIncorporateIntoReport={vi.fn()} 
        />
      );
      
      expect(screen.getByRole('button', { name: /incorporate into report/i })).toBeInTheDocument();
    });

    it('hides incorporate button when no onIncorporateIntoReport callback', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={false} />);
      
      expect(screen.queryByRole('button', { name: /incorporate into report/i })).not.toBeInTheDocument();
    });

    it('calls onIncorporateIntoReport when clicked', async () => {
      const user = userEvent.setup();
      const onIncorporateIntoReport = vi.fn().mockResolvedValue(undefined);
      
      render(
        <ChatPanel 
          messages={mockMessages} 
          isCollapsed={false} 
          onIncorporateIntoReport={onIncorporateIntoReport} 
        />
      );
      
      await user.click(screen.getByRole('button', { name: /incorporate into report/i }));
      
      expect(onIncorporateIntoReport).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('shows keyboard shortcut hint', () => {
      render(<ChatPanel messages={[]} isCollapsed={false} />);
      
      expect(screen.getByText(/⌘ \+ Enter/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper test IDs', () => {
      render(<ChatPanel messages={mockMessages} isCollapsed={false} />);
      
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('toggle button has accessible label', () => {
      render(<ChatPanel messages={[]} isCollapsed={true} />);
      
      expect(screen.getByRole('button', { name: /expand chat/i })).toBeInTheDocument();
    });

    it('expanded toggle button has accessible label', () => {
      render(<ChatPanel messages={[]} isCollapsed={false} />);
      
      expect(screen.getByRole('button', { name: /collapse chat/i })).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('handles XSS in user messages safely', () => {
      const maliciousMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '<script>alert("xss")</script>Normal text',
          timestamp: new Date(),
        },
      ];

      render(<ChatPanel messages={maliciousMessages} isCollapsed={false} />);
      
      const userMessage = screen.getByTestId('chat-message-user');
      // React escapes the script tag
      expect(userMessage.innerHTML).not.toContain('<script>');
    });

    it('handles XSS in agent messages via markdown sanitization', () => {
      const maliciousMessages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'agent',
          content: '<script>alert("xss")</script>Safe content',
          timestamp: new Date(),
        },
      ];

      render(<ChatPanel messages={maliciousMessages} isCollapsed={false} />);
      
      const agentMessage = screen.getByTestId('chat-message-agent');
      expect(agentMessage.innerHTML).not.toContain('<script>');
    });
  });

  describe('Custom Width', () => {
    it('accepts custom expanded width', () => {
      render(
        <ChatPanel 
          messages={[]} 
          isCollapsed={false} 
          expandedWidth="w-96" 
        />
      );
      
      const panel = screen.getByTestId('chat-panel');
      expect(panel).toHaveClass('w-96');
    });
  });
});
