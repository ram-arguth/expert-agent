/**
 * Workspace Switcher Component
 *
 * Dropdown for switching between personal workspace and team organizations.
 * Part of Phase 1.7: Workspace Switcher
 *
 * @see docs/DESIGN.md - Multi-Tenant Context
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ChevronDown, Building2, User, Plus, Check, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Types aligned with Prisma schema
interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'TEAM' | 'ENTERPRISE';
  plan: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'AUDITOR' | 'BILLING_MANAGER';
}

interface WorkspaceSwitcherProps {
  /** Currently active org ID (null = personal) */
  activeOrgId: string | null;
  /** Callback when workspace is switched */
  onSwitch: (orgId: string | null) => void;
  /** Current user's name/email */
  userName?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Hook to fetch user's organizations
 */
function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/org');
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  return { organizations, isLoading, error };
}

/**
 * Get role badge color
 */
function getRoleBadgeStyle(role: Organization['role']): string {
  switch (role) {
    case 'OWNER':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    case 'ADMIN':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'MEMBER':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'AUDITOR':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'BILLING_MANAGER':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function WorkspaceSwitcher({
  activeOrgId,
  onSwitch,
  userName = 'Personal',
  className,
}: WorkspaceSwitcherProps) {
  const { organizations, isLoading, error } = useOrganizations();
  const [open, setOpen] = useState(false);

  // Find the currently active organization
  const activeOrg = activeOrgId
    ? organizations.find((org) => org.id === activeOrgId)
    : null;

  // Display name for current context
  const displayName = activeOrg ? activeOrg.name : 'Personal';
  const displayIcon = activeOrg ? (
    <Building2 className="h-4 w-4" aria-hidden="true" />
  ) : (
    <User className="h-4 w-4" aria-hidden="true" />
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={`Current workspace: ${displayName}. Click to switch.`}
          className={cn(
            'flex items-center gap-2 px-3 py-2 h-auto font-medium',
            'hover:bg-accent focus:ring-2 focus:ring-offset-2',
            className
          )}
        >
          {displayIcon}
          <span className="max-w-[150px] truncate">{displayName}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 opacity-50 transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Personal workspace */}
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onSelect={() => {
            onSwitch(null);
            setOpen(false);
          }}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>Personal</span>
          </div>
          {!activeOrgId && (
            <Check className="h-4 w-4 text-primary" aria-label="Currently selected" />
          )}
        </DropdownMenuItem>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="px-2 py-4 text-sm text-destructive text-center">
            Failed to load organizations
          </div>
        )}

        {/* Organizations list */}
        {!isLoading && !error && organizations.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                className="flex items-center justify-between cursor-pointer"
                onSelect={() => {
                  onSwitch(org.id);
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2
                    className="h-4 w-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <span className="truncate">{org.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full',
                      getRoleBadgeStyle(org.role)
                    )}
                  >
                    {org.role.toLowerCase()}
                  </span>
                  {activeOrgId === org.id && (
                    <Check
                      className="h-4 w-4 text-primary"
                      aria-label="Currently selected"
                    />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Create new team */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer text-primary"
          onSelect={() => {
            // Navigate to create team page
            window.location.href = '/settings/teams/new';
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create new team</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
