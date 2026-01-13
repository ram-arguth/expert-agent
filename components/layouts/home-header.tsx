'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

/**
 * HomeHeader - Session-aware header for the landing page
 * Shows login/signup for unauthenticated users
 * Shows user avatar and dashboard link for authenticated users
 */
export function HomeHeader() {
  const { data: session, status } = useSession();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="container mx-auto flex items-center justify-between px-4 py-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <Bot className="text-primary h-8 w-8" />
        <span className="text-2xl font-bold">Expert AI</span>
      </Link>

      {/* Auth-aware Navigation */}
      <nav className="flex items-center gap-4">
        {status === 'loading' ? (
          // Loading skeleton
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        ) : session?.user ? (
          // Authenticated: Show dashboard link + avatar
          <div className="flex items-center gap-4">
            <Link href="/agents">
              <Button variant="ghost">Explore Agents</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <Link href="/dashboard">
              <Avatar className="h-9 w-9 cursor-pointer">
                {session.user.image && (
                  <AvatarImage src={session.user.image} alt={session.user.name || 'User'} />
                )}
                <AvatarFallback>
                  {session.user.name ? getInitials(session.user.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        ) : (
          // Unauthenticated: Show login/signup
          <div className="flex items-center gap-4">
            <Link href="/agents">
              <Button variant="ghost">Explore Agents</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
