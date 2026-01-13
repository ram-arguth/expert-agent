'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell,
  Menu,
  Search,
  User,
  LogOut,
  Settings,
  HelpCircle,
  MessageSquare,
  Book,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface HeaderUser {
  name: string;
  email: string;
  avatarUrl?: string;
  initials?: string;
}

export interface HeaderProps {
  user?: HeaderUser;
  isLoading?: boolean;
  showSearch?: boolean;
  onMenuClick?: () => void;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
  onReportIssue?: () => void;
  className?: string;
  // Context switcher for Personal/Team/Enterprise
  currentContext?: string;
  contexts?: { id: string; name: string; type: 'personal' | 'team' | 'enterprise' }[];
  onContextChange?: (contextId: string) => void;
}

export function Header({
  user,
  isLoading = false,
  showSearch = true,
  onMenuClick,
  onSearch,
  onLogout,
  onReportIssue,
  className,
  currentContext,
  contexts = [],
  onContextChange,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header
      className={cn('bg-card flex h-16 items-center justify-between border-b px-4', className)}
      data-testid="header"
    >
      {/* Left side - Menu button (mobile) + Context Switcher */}
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {/* Context Switcher (Personal/Team/Enterprise) */}
        {contexts.length > 0 && onContextChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden gap-2 md:flex">
                <Building2 className="h-4 w-4" />
                <span>{contexts.find((c) => c.id === currentContext)?.name || 'Personal'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {contexts.map((ctx) => (
                <DropdownMenuItem
                  key={ctx.id}
                  onClick={() => onContextChange(ctx.id)}
                  className={cn(ctx.id === currentContext && 'bg-accent')}
                >
                  {ctx.name}
                  <span className="text-muted-foreground ml-auto text-xs capitalize">
                    {ctx.type}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Search */}
        {showSearch && (
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search agents, reports..."
                className="w-64 pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
              />
            </div>
          </form>
        )}
      </div>

      {/* Right side - Notifications and User menu */}
      <div className="flex items-center gap-2">
        {!mounted || isLoading ? (
          // SSR/hydration/auth loading state - show skeleton to prevent flash
          <div className="flex items-center gap-2">
            <div className="bg-muted h-9 w-9 animate-pulse rounded-md" />
            <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />
          </div>
        ) : user ? (
          <>
            {/* Help menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Help">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Help & Support</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/help" className="flex w-full items-center">
                    <Book className="mr-2 h-4 w-4" />
                    Documentation
                  </Link>
                </DropdownMenuItem>
                {onReportIssue && (
                  <DropdownMenuItem onClick={onReportIssue} data-testid="report-issue">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Report Issue
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                  aria-label="User menu"
                  data-testid="user-menu"
                >
                  <Avatar className="h-9 w-9">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback>{user.initials || getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-muted-foreground text-xs">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="flex w-full items-center">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex w-full items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} data-testid="logout">
                  <span className="flex items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
