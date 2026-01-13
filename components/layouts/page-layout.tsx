'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header, HeaderUser } from './header';

export interface PageLayoutProps {
  children: React.ReactNode;
  user?: HeaderUser;
  isLoading?: boolean;
  onLogout?: () => void;
  className?: string;
  // Context for workspace switcher
  currentContext?: string;
  contexts?: { id: string; name: string; type: 'personal' | 'team' | 'enterprise' }[];
  onContextChange?: (contextId: string) => void;
}

export function PageLayout({
  children,
  user,
  isLoading,
  onLogout,
  className,
  currentContext,
  contexts,
  onContextChange,
}: PageLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          showOrgItems={!!currentContext && currentContext !== 'personal'}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="h-full w-64" onClick={(e) => e.stopPropagation()}>
            <Sidebar
              showOrgItems={!!currentContext && currentContext !== 'personal'}
              onToggle={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          isLoading={isLoading}
          onMenuClick={() => setMobileMenuOpen(true)}
          onLogout={onLogout}
          currentContext={currentContext}
          contexts={contexts}
          onContextChange={onContextChange}
        />

        <main className={cn('flex-1 overflow-y-auto p-6', className)}>{children}</main>
      </div>
    </div>
  );
}
