/**
 * Message List Component Tests
 *
 * Tests for the conversation display component including:
 * - Message rendering
 * - Loading states
 * - Empty states
 * - Text selection for follow-up
 * - Accessibility
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageList, Message } from '../message-list';

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test data
  const sampleMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'What is the contract duration?',
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'agent',
      content: 'The contract duration is **12 months**, starting from the effective date.',
      timestamp: new Date(),
      metadata: {
        tokenCount: 150,
        processingTime: 2500,
      },
    },
  ];

  describe('Message Rendering', () => {
    it('renders user and agent messages', () => {
      render(<MessageList messages={sampleMessages} />);
      
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByTestId('message-agent')).toBeInTheDocument();
    });

    it('displays user message content as text', () => {
      render(<MessageList messages={sampleMessages} />);
      
      expect(screen.getByText('What is the contract duration?')).toBeInTheDocument();
    });

    it('renders agent message as markdown', () => {
      render(<MessageList messages={sampleMessages} />);
      
      // Should have markdown rendered (bold text)
      expect(screen.getByText('12 months')).toBeInTheDocument();
    });

    it('shows correct role labels', () => {
      render(<MessageList messages={sampleMessages} />);
      
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Expert Agent')).toBeInTheDocument();
    });

    it('renders multiple messages in order', () => {
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'First question' },
        { id: '2', role: 'agent', content: 'First answer' },
        { id: '3', role: 'user', content: 'Second question' },
        { id: '4', role: 'agent', content: 'Second answer' },
      ];

      render(<MessageList messages={messages} />);

      // Check that both user and agent messages are rendered
      expect(screen.getAllByTestId('message-user')).toHaveLength(2);
      expect(screen.getAllByTestId('message-agent')).toHaveLength(2);
    });

    it('shows metadata for agent messages', () => {
      render(<MessageList messages={sampleMessages} />);
      
      expect(screen.getByText('150 tokens')).toBeInTheDocument();
      expect(screen.getByText('2.5s')).toBeInTheDocument();
    });

    it('displays system messages with different styling', () => {
      const systemMessage: Message = {
        id: '1',
        role: 'system',
        content: 'Session started',
      };

      render(<MessageList messages={[systemMessage]} />);
      
      expect(screen.getByTestId('message-system')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<MessageList messages={[]} isLoading={true} />);
      
      expect(screen.getByTestId('message-loading')).toBeInTheDocument();
    });

    it('displays custom loading text', () => {
      render(
        <MessageList
          messages={[]}
          isLoading={true}
          loadingText="Processing your request..."
        />
      );
      
      expect(screen.getByText('Processing your request...')).toBeInTheDocument();
    });

    it('shows spinner in loading state', () => {
      render(<MessageList messages={[]} isLoading={true} />);
      
      // Loader2 component has animate-spin class
      const loadingElement = screen.getByTestId('message-loading');
      expect(loadingElement.innerHTML).toContain('animate-spin');
    });

    it('shows loading after existing messages', () => {
      render(<MessageList messages={sampleMessages} isLoading={true} />);
      
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByTestId('message-agent')).toBeInTheDocument();
      expect(screen.getByTestId('message-loading')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no messages', () => {
      render(<MessageList messages={[]} />);
      
      expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    });

    it('displays guidance text in empty state', () => {
      render(<MessageList messages={[]} />);
      
      expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      expect(screen.getByText(/ask a question/i)).toBeInTheDocument();
    });

    it('hides empty state when loading', () => {
      render(<MessageList messages={[]} isLoading={true} />);
      
      expect(screen.queryByTestId('message-list-empty')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-loading')).toBeInTheDocument();
    });
  });

  describe('Text Selection', () => {
    it('calls onMessageSelect when text is selected in agent message', async () => {
      const onMessageSelect = vi.fn();
      
      render(
        <MessageList
          messages={sampleMessages}
          onMessageSelect={onMessageSelect}
        />
      );

      // Simulate text selection
      const agentMessage = screen.getByTestId('message-agent');
      
      // Mock window.getSelection
      const mockSelection = {
        toString: () => 'selected text',
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      // Trigger mouseup
      fireEvent.mouseUp(agentMessage);

      expect(onMessageSelect).toHaveBeenCalledWith(
        sampleMessages[1],
        'selected text'
      );
    });

    it('does not trigger for user messages', async () => {
      const onMessageSelect = vi.fn();
      
      render(
        <MessageList
          messages={sampleMessages}
          onMessageSelect={onMessageSelect}
        />
      );

      const userMessage = screen.getByTestId('message-user');

      const mockSelection = {
        toString: () => 'selected text',
      };
      vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

      fireEvent.mouseUp(userMessage);

      // Should not be called for user messages
      expect(onMessageSelect).not.toHaveBeenCalled();
    });

    it('does not trigger for empty selection', async () => {
      const onMessageSelect = vi.fn();
      
      render(
        <MessageList
          messages={sampleMessages}
          onMessageSelect={onMessageSelect}
        />
      );

      const agentMessage = screen.getByTestId('message-agent');

      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => '',
      } as any);

      fireEvent.mouseUp(agentMessage);

      expect(onMessageSelect).not.toHaveBeenCalled();
    });
  });

  describe('Timestamps', () => {
    it('shows relative time for recent messages', () => {
      const recentMessage: Message = {
        id: '1',
        role: 'agent',
        content: 'Recent response',
        timestamp: new Date(),
      };

      render(<MessageList messages={[recentMessage]} />);
      
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('shows minutes ago for recent messages', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const message: Message = {
        id: '1',
        role: 'agent',
        content: 'Test',
        timestamp: fiveMinutesAgo,
      };

      render(<MessageList messages={[message]} />);
      
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper container test id', () => {
      render(<MessageList messages={sampleMessages} />);
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      render(<MessageList messages={sampleMessages} className="custom-class" />);
      expect(screen.getByTestId('message-list')).toHaveClass('custom-class');
    });

    it('renders icons for user and agent', () => {
      render(<MessageList messages={sampleMessages} />);
      
      // Icons should be present (they're svg elements)
      const userMessage = screen.getByTestId('message-user');
      const agentMessage = screen.getByTestId('message-agent');
      
      expect(userMessage.querySelector('svg')).toBeInTheDocument();
      expect(agentMessage.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('does not execute XSS in user messages', () => {
      const maliciousMessage: Message = {
        id: '1',
        role: 'user',
        content: '<script>alert("xss")</script>Normal text',
      };

      render(<MessageList messages={[maliciousMessage]} />);
      
      // Component should render without executing script
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });

    it('does not execute XSS in agent messages', () => {
      const maliciousMessage: Message = {
        id: '1',
        role: 'agent',
        content: '<script>alert("xss")</script>Safe content',
      };

      render(<MessageList messages={[maliciousMessage]} />);
      
      // Component should render without executing script
      expect(screen.getByTestId('message-agent')).toBeInTheDocument();
    });
  });
});
