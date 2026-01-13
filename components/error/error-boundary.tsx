'use client';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Prevents entire app from crashing due to component errors.
 */

import * as React from 'react';
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Custom fallback UI */
  fallback?: React.ReactNode;
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Whether to show error details */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// Error Fallback Component
// ============================================

export interface ErrorFallbackProps {
  /** The error that occurred */
  error?: Error | null;
  /** Called when retry is clicked */
  onRetry?: () => void;
  /** Called when go home is clicked */
  onGoHome?: () => void;
  /** Called when report issue is clicked */
  onReportIssue?: () => void;
  /** Whether to show error details */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function ErrorFallback({
  error,
  onRetry,
  onGoHome,
  onReportIssue,
  showDetails = false,
  className,
}: ErrorFallbackProps) {
  return (
    <Card className={cn('mx-auto max-w-md', className)} data-testid="error-fallback">
      <CardContent className="p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
        <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">
          We&apos;re sorry, but something unexpected happened. Please try again or return home.
        </p>

        {showDetails && error && (
          <div className="bg-muted mb-6 rounded-lg p-3 text-left">
            <p
              className="text-muted-foreground font-mono text-xs break-all"
              data-testid="error-message"
            >
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {onRetry && (
            <Button onClick={onRetry} data-testid="retry-btn">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {onGoHome && (
            <Button variant="outline" onClick={onGoHome} data-testid="home-btn">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>

        {onReportIssue && (
          <div className="mt-4">
            <Button
              variant="link"
              onClick={onReportIssue}
              className="text-muted-foreground"
              data-testid="report-issue-btn"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Report this issue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Error Boundary Class Component
// ============================================

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}
