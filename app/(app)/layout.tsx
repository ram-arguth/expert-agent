'use client';

import { useSession, signOut } from 'next-auth/react';
import { PageLayout } from '@/components/layouts';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        name: session.user.name || 'User',
        email: session.user.email || '',
        avatarUrl: session.user.image || undefined,
      }
    : undefined;

  // Example contexts - in real app, fetch from API based on user's memberships
  const contexts = [
    { id: 'personal', name: 'Personal', type: 'personal' as const },
    // Add team/enterprise contexts when user is a member
  ];

  return (
    <PageLayout
      user={user}
      isLoading={status === 'loading'}
      onLogout={() => signOut({ callbackUrl: '/' })}
      contexts={contexts}
      currentContext="personal"
      onContextChange={(contextId) => {
        // TODO: Implement context switching
        console.log('Switch to context:', contextId);
      }}
    >
      {children}
    </PageLayout>
  );
}
