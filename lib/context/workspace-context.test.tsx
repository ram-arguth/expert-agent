/**
 * Workspace Context Tests
 *
 * Tests for the WorkspaceProvider and related hooks.
 * Covers context propagation, cookie management, and security.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  WorkspaceProvider,
  useWorkspace,
  useActiveOrgId,
  getActiveOrgFromCookies,
  createOrgHeaders,
  type OrgInfo,
} from './workspace-context';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock organizations
const mockOrganizations: OrgInfo[] = [
  { id: 'org-1', name: 'Team Alpha', slug: 'team-alpha', role: 'OWNER', type: 'TEAM' },
  { id: 'org-2', name: 'Enterprise Corp', slug: 'enterprise', role: 'MEMBER', type: 'ENTERPRISE' },
];

// Cookie helper for tests
function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function clearCookies(): void {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim();
    document.cookie = `${name}=; path=/; max-age=0`;
  });
}

describe('WorkspaceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookies();

    // Default mock for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ organizations: mockOrganizations }),
    });
  });

  afterEach(() => {
    clearCookies();
  });

  describe('WorkspaceProvider', () => {
    it('provides default context values', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider>{children}</WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeOrgId).toBeNull();
      expect(result.current.isPersonalContext).toBe(true);
    });

    it('fetches organizations on mount', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider>{children}</WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      await waitFor(() => {
        expect(result.current.organizations).toHaveLength(2);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/org');
    });

    it('uses initial organizations without fetching', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider initialOrganizations={mockOrganizations}>
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.organizations).toEqual(mockOrganizations);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('uses initial activeOrgId', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-1"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.activeOrgId).toBe('org-1');
      expect(result.current.isPersonalContext).toBe(false);
    });
  });

  describe('switchWorkspace', () => {
    it('switches to organization and sets cookie', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider initialOrganizations={mockOrganizations}>
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      act(() => {
        result.current.switchWorkspace('org-1');
      });

      expect(result.current.activeOrgId).toBe('org-1');
      expect(result.current.activeOrg?.name).toBe('Team Alpha');
      expect(getCookieValue('expert_active_org')).toBe('org-1');
    });

    it('switches to personal context and clears cookie', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-1"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      act(() => {
        result.current.switchWorkspace(null);
      });

      expect(result.current.activeOrgId).toBeNull();
      expect(result.current.isPersonalContext).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('returns true for matching role', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-1"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.hasRole('owner')).toBe(true);
    });

    it('returns false for non-matching role', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-2"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.hasRole('owner')).toBe(false);
      expect(result.current.hasRole('member')).toBe(true);
    });

    it('returns false in personal context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider initialOrganizations={mockOrganizations}>
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.hasRole('owner')).toBe(false);
    });

    it('accepts array of roles', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-1"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      expect(result.current.hasRole(['owner', 'admin'])).toBe(true);
      expect(result.current.hasRole(['member', 'admin'])).toBe(false);
    });
  });

  describe('Security Tests', () => {
    it('clears invalid activeOrgId not in org list', async () => {
      // Set a cookie for an org the user doesn't belong to
      document.cookie = 'expert_active_org=invalid-org-id; path=/';

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider initialOrganizations={mockOrganizations}>
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeOrgId).toBeNull();
      });

      // Cookie should be cleared
      expect(getCookieValue('expert_active_org')).toBeNull();
    });

    it('prevents accessing org user is not a member of', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="non-existent-org"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useWorkspace(), { wrapper });

      // Should fall back to null when org doesn't exist
      expect(result.current.activeOrg).toBeNull();
    });
  });

  describe('useActiveOrgId', () => {
    it('returns undefined in personal context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider initialOrganizations={mockOrganizations}>
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useActiveOrgId(), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('returns org ID when in org context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WorkspaceProvider
          initialOrganizations={mockOrganizations}
          initialActiveOrgId="org-1"
        >
          {children}
        </WorkspaceProvider>
      );

      const { result } = renderHook(() => useActiveOrgId(), { wrapper });

      expect(result.current).toBe('org-1');
    });
  });

  describe('useWorkspace outside provider', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkspace());
      }).toThrow('useWorkspace must be used within a WorkspaceProvider');

      spy.mockRestore();
    });
  });
});

describe('getActiveOrgFromCookies', () => {
  it('returns null for null cookie header', () => {
    expect(getActiveOrgFromCookies(null)).toBeNull();
  });

  it('returns null when cookie not present', () => {
    expect(getActiveOrgFromCookies('other_cookie=value')).toBeNull();
  });

  it('extracts org ID from cookie header', () => {
    expect(
      getActiveOrgFromCookies('other=foo; expert_active_org=org-123; bar=baz')
    ).toBe('org-123');
  });

  it('handles cookie as first item', () => {
    expect(getActiveOrgFromCookies('expert_active_org=org-456')).toBe('org-456');
  });
});

describe('createOrgHeaders', () => {
  it('creates headers without org ID', () => {
    const headers = createOrgHeaders();

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Active-Org']).toBeUndefined();
  });

  it('creates headers with org ID', () => {
    const headers = createOrgHeaders('org-123');

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Active-Org']).toBe('org-123');
  });

  it('handles null org ID', () => {
    const headers = createOrgHeaders(null);

    expect(headers['X-Active-Org']).toBeUndefined();
  });
});
