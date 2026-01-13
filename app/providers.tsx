'use client';

/**
 * Providers Component
 *
 * Wraps the application with all required context providers.
 * This is a client component because SessionProvider requires 'use client'.
 *
 * @see https://next-auth.js.org/getting-started/client#sessionprovider
 */

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toast';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
