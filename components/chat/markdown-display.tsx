/**
 * Markdown Display Component
 *
 * Renders Markdown content safely with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - Syntax-highlighted code blocks
 * - XSS sanitization
 * - Responsive styling
 *
 * @see docs/IMPEMENTATION.md - Phase 4.3
 * @see docs/DESIGN.md - Chat/Document Display
 */

'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

/**
 * Props for the MarkdownDisplay component
 */
export interface MarkdownDisplayProps {
  /** Markdown content to render */
  content: string;
  /** Additional CSS classes */
  className?: string;
  /** Enable syntax highlighting for code blocks */
  highlightCode?: boolean;
  /** Custom test ID for testing */
  testId?: string;
}

/**
 * Code block component for syntax highlighting
 */
function CodeBlock({
  className,
  children,
  inline,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
  inline?: boolean;
  node?: unknown;
}) {
  // Extract language from className (format: "language-{lang}")
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';

  if (inline) {
    return (
      <code
        className={cn(
          'px-1.5 py-0.5 rounded-md bg-muted font-mono text-sm',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative">
      {language && (
        <div className="absolute top-0 right-0 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-bl-md">
          {language}
        </div>
      )}
      <pre
        className={cn(
          'p-4 rounded-lg bg-muted overflow-x-auto font-mono text-sm',
          language && 'pt-8'
        )}
      >
        <code className={cn('text-foreground', className)} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

/**
 * MarkdownDisplay Component
 *
 * Safely renders Markdown content with GFM support and XSS protection.
 */
export function MarkdownDisplay({
  content,
  className,
  highlightCode = true,
  testId = 'markdown-display',
}: MarkdownDisplayProps) {
  return (
    <div
      className={cn(
        'prose prose-neutral dark:prose-invert max-w-none',
        // Headings
        'prose-headings:font-semibold prose-headings:tracking-tight',
        // Links
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        // Lists
        'prose-ul:list-disc prose-ol:list-decimal',
        // Tables
        'prose-table:border-collapse prose-th:border prose-th:p-2 prose-th:bg-muted',
        'prose-td:border prose-td:p-2',
        // Blockquotes
        'prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic',
        // Images
        'prose-img:rounded-lg',
        className
      )}
      data-testid={testId}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Custom code block rendering
          code: highlightCode
            ? ({ className, children, ...props }) => {
                // Detect if inline by checking for presence of newlines
                const inline = !String(children).includes('\n');
                return (
                  <CodeBlock
                    className={className}
                    inline={inline}
                    {...props}
                  >
                    {children}
                  </CodeBlock>
                );
              }
            : undefined,
          // Custom link handling - open external links in new tab
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * MarkdownDisplaySkeleton - Loading placeholder for markdown content
 */
export function MarkdownDisplaySkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('space-y-3 animate-pulse', className)}
      data-testid="markdown-skeleton"
    >
      {/* Title skeleton */}
      <div className="h-8 bg-muted rounded-md w-3/4" />
      
      {/* Paragraph skeletons */}
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
      
      {/* Another section */}
      <div className="h-6 bg-muted rounded-md w-1/2 mt-4" />
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-4/5" />
      </div>
      
      {/* Code block skeleton */}
      <div className="h-24 bg-muted rounded-lg w-full" />
    </div>
  );
}
