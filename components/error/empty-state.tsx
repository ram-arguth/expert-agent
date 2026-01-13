'use client';

/**
 * EmptyState Component
 *
 * Generic empty state component for when there's no data to display.
 * Provides context and a call-to-action.
 */

import * as React from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Icon to display */
  icon?: React.ComponentType<{ className?: string }>;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action label */
  actionLabel?: string;
  /** Called when primary action clicked */
  onAction?: () => void;
  /** Secondary action label */
  secondaryLabel?: string;
  /** Called when secondary action clicked */
  onSecondary?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  size = 'md',
  className,
}: EmptyStateProps) {
  const sizeStyles = {
    sm: {
      container: 'py-6',
      icon: 'h-10 w-10',
      iconContainer: 'h-16 w-16',
      title: 'text-base',
      description: 'text-sm',
    },
    md: {
      container: 'py-12',
      icon: 'h-12 w-12',
      iconContainer: 'h-20 w-20',
      title: 'text-lg',
      description: 'text-base',
    },
    lg: {
      container: 'py-16',
      icon: 'h-16 w-16',
      iconContainer: 'h-24 w-24',
      title: 'text-xl',
      description: 'text-base',
    },
  };

  const styles = sizeStyles[size];

  return (
    <Card className={className} data-testid="empty-state">
      <CardContent className={cn('text-center', styles.container)}>
        <div className="mb-4 flex justify-center">
          <div
            className={cn(
              'bg-muted flex items-center justify-center rounded-full',
              styles.iconContainer
            )}
          >
            <Icon className={cn('text-muted-foreground', styles.icon)} />
          </div>
        </div>
        <h3 className={cn('mb-2 font-semibold', styles.title)} data-testid="empty-title">
          {title}
        </h3>
        {description && (
          <p
            className={cn('text-muted-foreground mx-auto mb-6 max-w-sm', styles.description)}
            data-testid="empty-description"
          >
            {description}
          </p>
        )}
        {(actionLabel || secondaryLabel) && (
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {actionLabel && onAction && (
              <Button onClick={onAction} data-testid="empty-action-btn">
                <Plus className="mr-2 h-4 w-4" />
                {actionLabel}
              </Button>
            )}
            {secondaryLabel && onSecondary && (
              <Button variant="outline" onClick={onSecondary} data-testid="empty-secondary-btn">
                {secondaryLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
