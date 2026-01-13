'use client';

/**
 * AuthGuard Component
 *
 * Protects routes that require authentication.
 * Redirects to login page if user is not authenticated.
 */

import * as React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { PageSkeleton } from '@/components/error';

export interface AuthGuardProps {
  /** Child components to render when authenticated */
  children: React.ReactNode;
  /** URL to redirect to when not authenticated */
  loginUrl?: string;
  /** Whether to show loading skeleton while checking auth */
  showLoading?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
}

export function AuthGuard({
  children,
  loginUrl = '/login',
  showLoading = true,
  loadingComponent,
}: AuthGuardProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      // Encode current path for return URL
      const returnUrl = encodeURIComponent(pathname || '/');
      router.replace(`${loginUrl}?returnUrl=${returnUrl}`);
    }
  }, [status, router, pathname, loginUrl]);

  if (status === 'loading') {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    if (showLoading) {
      return <PageSkeleton variant="dashboard" />;
    }
    return null;
  }

  if (status === 'unauthenticated') {
    // Will redirect in useEffect, show nothing or loading
    return showLoading ? <PageSkeleton variant="dashboard" /> : null;
  }

  return <>{children}</>;
}
