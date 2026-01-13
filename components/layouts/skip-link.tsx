'use client';

/**
 * SkipLink Component
 *
 * Accessibility skip navigation link that appears on focus.
 * Allows keyboard users to skip repetitive navigation.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkipLinkProps {
  /** Target element ID (without #) */
  href?: string;
  /** Link text */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

export function SkipLink({
  href = '#main-content',
  label = 'Skip to main content',
  className,
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Hidden by default, visible on focus
        'sr-only focus:not-sr-only',
        // Positioning
        'focus:absolute focus:top-4 focus:left-4 focus:z-[100]',
        // Styling
        'focus:rounded-md focus:px-4 focus:py-2',
        'focus:bg-primary focus:text-primary-foreground',
        'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
        // Font
        'focus:text-sm focus:font-medium',
        className
      )}
      data-testid="skip-link"
    >
      {label}
    </a>
  );
}
