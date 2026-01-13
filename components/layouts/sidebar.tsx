'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  FileText,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

// Navigation items aligned with Expert Agent Platform DESIGN.md
const defaultNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Expert Agents', href: '/agents', icon: Bot },
  { title: 'Conversations', href: '/conversations', icon: MessageSquare },
  { title: 'Reports', href: '/reports', icon: FileText },
  { title: 'Settings', href: '/settings', icon: Settings },
  { title: 'Help', href: '/help', icon: HelpCircle },
];

// Additional nav items for organization context
const orgNavItems: NavItem[] = [
  { title: 'Organization', href: '/organization', icon: Building2 },
  { title: 'Billing', href: '/billing', icon: CreditCard },
];

export interface SidebarProps {
  items?: NavItem[];
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
  showOrgItems?: boolean;
}

export function Sidebar({
  items = defaultNavItems,
  collapsed = false,
  onToggle,
  className,
  showOrgItems = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const logoHref = isAuthenticated ? '/dashboard' : '/';

  const allItems = showOrgItems ? [...items, ...orgNavItems] : items;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-card flex h-full flex-col border-r transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          className
        )}
        data-testid="sidebar"
      >
        {/* Logo area */}
        <div className="flex h-16 items-center border-b px-4">
          <Link href={logoHref} className="flex items-center gap-2">
            <Bot className="text-primary h-6 w-6" />
            {!collapsed && <span className="text-primary text-xl font-bold">Expert AI</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2" role="navigation" aria-label="Main navigation">
          {allItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-2'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
                {!collapsed && item.badge && (
                  <span className="bg-primary/10 ml-auto rounded-full px-2 py-0.5 text-xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>

        {/* Collapse toggle */}
        {onToggle && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="w-full justify-center"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
