"use client";

/**
 * Providers Component
 *
 * Wraps the application with all required context providers.
 * This is a client component because SessionProvider requires 'use client'.
 *
 * @see https://next-auth.js.org/getting-started/client#sessionprovider
 * @see lib/context/workspace-context.tsx - WorkspaceProvider for org context
 */

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toast";
import { WorkspaceProvider } from "@/lib/context/workspace-context";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <WorkspaceProvider>
        {children}
        <Toaster />
      </WorkspaceProvider>
    </SessionProvider>
  );
}
