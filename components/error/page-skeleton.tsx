'use client';

/**
 * PageSkeleton Component
 *
 * Full-page loading skeleton for initial page loads.
 * Provides visual feedback while content is loading.
 */

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type PageSkeletonVariant = 'dashboard' | 'list' | 'detail' | 'settings';

export interface PageSkeletonProps {
  /** Layout variant */
  variant?: PageSkeletonVariant;
  /** Additional CSS classes */
  className?: string;
}

export function PageSkeleton({ variant = 'dashboard', className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} data-testid="page-skeleton">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" data-testid="skeleton-title" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" data-testid="skeleton-button" />
      </div>

      {/* Content based on variant */}
      {variant === 'dashboard' && <DashboardSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {variant === 'detail' && <DetailSkeleton />}
      {variant === 'settings' && <SettingsSkeleton />}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4" data-testid="skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      {/* Header with icon */}
      <div className="flex gap-6">
        <Skeleton className="h-32 w-32 rounded-lg" data-testid="skeleton-image" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      {/* Content blocks */}
      <div className="space-y-3" data-testid="skeleton-content">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-4">
              <Skeleton className="h-6 w-16" />
              <div className="flex-1">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} data-testid="skeleton-settings">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card data-testid="skeleton-list">
      <CardContent className="divide-y p-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
