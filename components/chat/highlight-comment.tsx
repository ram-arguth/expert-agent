/**
 * Highlight Comment Component
 *
 * Enables inline follow-up questions based on selected text.
 * Shows a tooltip near selection and opens a popover for input.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.4
 * @see docs/DESIGN.md - Highlight & Comment
 */

'use client';

import * as React from 'react';
import { MessageSquarePlus, X, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/**
 * Props for the HighlightComment component
 */
export interface HighlightCommentProps {
  /** The target element to monitor for text selection */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** Callback when a follow-up question is submitted */
  onSubmit?: (data: FollowUpData) => Promise<void>;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Data structure for follow-up questions
 */
export interface FollowUpData {
  /** The selected text that prompted the follow-up */
  selectedText: string;
  /** The user's follow-up question */
  question: string;
  /** Full context string for the AI */
  contextString: string;
}

/**
 * Selection position data
 */
interface SelectionPosition {
  top: number;
  left: number;
  text: string;
}

/**
 * HighlightComment Component
 *
 * Watches for text selection in the target element and provides
 * a UI for asking follow-up questions about the selected text.
 */
export function HighlightComment({
  targetRef,
  onSubmit,
  className,
}: HighlightCommentProps) {
  const [selection, setSelection] = React.useState<SelectionPosition | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [question, setQuestion] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Handle text selection
  const handleMouseUp = React.useCallback((event: MouseEvent) => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const windowSelection = window.getSelection();
      const selectedText = windowSelection?.toString().trim();

      if (!selectedText || selectedText.length < 3) {
        // Ignore very short selections
        setSelection(null);
        return;
      }

      // Check if selection is within our target element
      if (targetRef?.current) {
        const range = windowSelection?.getRangeAt(0);
        const container = range?.commonAncestorContainer;
        if (!container || !targetRef.current.contains(container as Node)) {
          return;
        }
      }

      // Get position for tooltip
      const range = windowSelection?.getRangeAt(0);
      if (range) {
        const rect = range.getBoundingClientRect();
        setSelection({
          top: rect.top + window.scrollY - 40,
          left: rect.left + window.scrollX + rect.width / 2,
          text: selectedText,
        });
        setIsPopoverOpen(false);
        setQuestion('');
      }
    }, 10);
  }, [targetRef]);

  // Handle clicks outside to dismiss
  const handleClickOutside = React.useCallback((event: MouseEvent) => {
    const target = event.target as Node;
    
    // Don't dismiss if clicking on tooltip or popover
    if (tooltipRef.current?.contains(target) || popoverRef.current?.contains(target)) {
      return;
    }
    
    // Don't dismiss if there's a valid selection
    const windowSelection = window.getSelection();
    const selectedText = windowSelection?.toString().trim();
    if (selectedText && selectedText.length >= 3) {
      return;
    }
    
    setSelection(null);
    setIsPopoverOpen(false);
  }, []);

  // Handle escape key
  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setSelection(null);
      setIsPopoverOpen(false);
    }
  }, []);

  // Set up event listeners
  React.useEffect(() => {
    const target = targetRef?.current || document;
    
    target.addEventListener('mouseup', handleMouseUp as EventListener);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      target.removeEventListener('mouseup', handleMouseUp as EventListener);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [targetRef, handleMouseUp, handleClickOutside, handleKeyDown]);

  // Open the popover for input
  const handleOpenPopover = React.useCallback(() => {
    setIsPopoverOpen(true);
  }, []);

  // Handle form submission
  const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selection?.text || !question.trim() || !onSubmit) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const contextString = `Regarding: "${selection.text}"\n\nUser asks: ${question}`;
      
      await onSubmit({
        selectedText: selection.text,
        question: question.trim(),
        contextString,
      });

      // Clear state on success
      setSelection(null);
      setIsPopoverOpen(false);
      setQuestion('');
    } catch (error) {
      console.error('Failed to submit follow-up:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selection, question, onSubmit]);

  // Handle keyboard shortcut for submit
  const handleTextareaKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Cmd/Ctrl + Enter
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSubmit(event as unknown as React.FormEvent);
      }
    },
    [handleSubmit]
  );

  if (!selection) {
    return null;
  }

  return (
    <div className={cn('fixed z-50', className)} data-testid="highlight-comment">
      {/* Tooltip */}
      {!isPopoverOpen && (
        <div
          ref={tooltipRef}
          className="absolute transform -translate-x-1/2 animate-in fade-in-0 zoom-in-95"
          style={{ top: selection.top, left: selection.left }}
          data-testid="highlight-tooltip"
        >
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg gap-2"
            onClick={handleOpenPopover}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Ask about this
          </Button>
        </div>
      )}

      {/* Popover */}
      {isPopoverOpen && (
        <div
          ref={popoverRef}
          className="absolute transform -translate-x-1/2 animate-in fade-in-0 zoom-in-95 w-80"
          style={{ top: selection.top - 10, left: selection.left }}
          data-testid="highlight-popover"
        >
          <div className="bg-popover border rounded-lg shadow-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">
                  Asking about:
                </p>
                <p className="text-sm font-medium line-clamp-2" data-testid="selected-text">
                  &ldquo;{selection.text}&rdquo;
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setSelection(null);
                  setIsPopoverOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit}>
              <Textarea
                placeholder="What would you like to know about this?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                rows={3}
                className="resize-none"
                disabled={isSubmitting}
                autoFocus
                data-testid="follow-up-input"
              />
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  ⌘ + Enter to send
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!question.trim() || isSubmitting}
                >
                  {isSubmitting ? (
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
