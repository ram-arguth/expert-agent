'use client';

/**
 * Breadcrumb Component
 *
 * Navigation breadcrumbs showing the current location in the app hierarchy.
 */

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  /** Display label for this breadcrumb */
  label: string;
  /** URL to navigate to (optional for current page) */
  href?: string;
  /** Optional icon to show before label */
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  /** Array of breadcrumb items (excluding Home) */
  items: BreadcrumbItem[];
  /** Whether to show Home as first item (default: true) */
  showHome?: boolean;
  /** Custom home href (default: /) */
  homeHref?: string;
  /** Additional CSS classes */
  className?: string;
}

export function Breadcrumb({ items, showHome = true, homeHref = '/', className }: BreadcrumbProps) {
  // Build full items list including Home
  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: homeHref, icon: <Home className="h-4 w-4" /> }, ...items]
    : items;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-sm ${className ?? ''}`}
      data-testid="breadcrumb"
    >
      <ol className="flex items-center gap-1">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;

          return (
            <li key={item.label} className="flex items-center">
              {/* Separator (not on first item) */}
              {index > 0 && <ChevronRight className="text-muted-foreground mx-1 h-4 w-4" />}

              {/* Breadcrumb link or text */}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1 ${
                    isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
