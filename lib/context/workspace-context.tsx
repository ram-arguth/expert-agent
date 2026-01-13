/**
 * Workspace Context Provider
 *
 * Manages the active organization context across the application.
 * Stores activeOrgId in a cookie for persistence across requests.
 *
 * @see docs/DESIGN.md - Multi-Tenancy section
 * @see docs/IMPLEMENTATION.md - Phase 1.7 Context Propagation
 */

'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from 'react';

// Cookie name for storing active org
const ACTIVE_ORG_COOKIE = 'expert_active_org';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Organization info type
export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
  type: 'INDIVIDUAL' | 'TEAM' | 'ENTERPRISE';
}

// Context value type
export interface WorkspaceContextValue {
  /** Current active organization ID (null = personal context) */
  activeOrgId: string | null;

  /** Current active organization details */
  activeOrg: OrgInfo | null;

  /** List of organizations the user belongs to */
  organizations: OrgInfo[];

  /** Whether organizations are still loading */
  isLoading: boolean;

  /** Switch to a different organization */
  switchWorkspace: (orgId: string | null) => void;

  /** Check if user has a specific role in the active org */
  hasRole: (role: string | string[]) => boolean;

  /** Check if user is in personal context */
  isPersonalContext: boolean;

  /** Refresh organizations list */
  refresh: () => Promise<void>;
}

// Create context with undefined default
const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

// Cookie helpers
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${name}=; path=/; max-age=0`;
}

// Provider props
interface WorkspaceProviderProps {
  children: React.ReactNode;
  /** Initial organizations (for SSR) */
  initialOrganizations?: OrgInfo[];
  /** Initial active org ID (for SSR) */
  initialActiveOrgId?: string | null;
}

/**
 * WorkspaceProvider component that manages organization context
 */
export function WorkspaceProvider({
  children,
  initialOrganizations = [],
  initialActiveOrgId,
}: WorkspaceProviderProps) {
  const [organizations, setOrganizations] =
    useState<OrgInfo[]>(initialOrganizations);
  const [isLoading, setIsLoading] = useState(initialOrganizations.length === 0);

  // Initialize activeOrgId from cookie or prop
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    if (initialActiveOrgId !== undefined) return initialActiveOrgId;
    return getCookie(ACTIVE_ORG_COOKIE);
  });

  // Fetch organizations on mount
  useEffect(() => {
    if (initialOrganizations.length === 0) {
      fetchOrganizations();
    }
  }, [initialOrganizations.length]);

  // Validate activeOrgId against available orgs
  useEffect(() => {
    if (!isLoading && activeOrgId) {
      const orgExists = organizations.some((org) => org.id === activeOrgId);
      if (!orgExists) {
        // Clear invalid org ID
        setActiveOrgId(null);
        deleteCookie(ACTIVE_ORG_COOKIE);
      }
    }
  }, [organizations, activeOrgId, isLoading]);

  // Fetch organizations from API
  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/org');

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Switch workspace
  const switchWorkspace = useCallback((orgId: string | null) => {
    setActiveOrgId(orgId);

    if (orgId) {
      setCookie(ACTIVE_ORG_COOKIE, orgId, COOKIE_MAX_AGE);
    } else {
      deleteCookie(ACTIVE_ORG_COOKIE);
    }

    // Optionally trigger page refresh or notify server
    // For now, just update state - API calls will include the new context
  }, []);

  // Check role in active org
  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!activeOrgId) return false;

      const activeOrg = organizations.find((org) => org.id === activeOrgId);
      if (!activeOrg) return false;

      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(activeOrg.role.toLowerCase());
    },
    [activeOrgId, organizations]
  );

  // Compute active org
  const activeOrg = useMemo(() => {
    if (!activeOrgId) return null;
    return organizations.find((org) => org.id === activeOrgId) || null;
  }, [activeOrgId, organizations]);

  // Context value
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeOrgId,
      activeOrg,
      organizations,
      isLoading,
      switchWorkspace,
      hasRole,
      isPersonalContext: activeOrgId === null,
      refresh: fetchOrganizations,
    }),
    [
      activeOrgId,
      activeOrg,
      organizations,
      isLoading,
      switchWorkspace,
      hasRole,
      fetchOrganizations,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 * @throws Error if used outside WorkspaceProvider
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }

  return context;
}

/**
 * Hook to get active org ID for API calls
 * Returns undefined if in personal context
 */
export function useActiveOrgId(): string | undefined {
  const { activeOrgId } = useWorkspace();
  return activeOrgId ?? undefined;
}

/**
 * Server-side helper to get active org from cookies
 * Use in Server Components or API routes
 */
export function getActiveOrgFromCookies(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === ACTIVE_ORG_COOKIE) {
      return value || null;
    }
  }
  return null;
}

/**
 * Create headers with active org context for fetch calls
 */
export function createOrgHeaders(
  activeOrgId?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (activeOrgId) {
    headers['X-Active-Org'] = activeOrgId;
  }

  return headers;
}
