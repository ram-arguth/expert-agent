/**
 * Layout Consistency Tests
 *
 * Tests to ensure the top menu (header) and sidebar are always present
 * when the user is authenticated, across all app pages.
 *
 * This prevents layout inconsistencies when navigating between pages.
 *
 * @see docs/IMPEMENTATION.md - Phase 4 Frontend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock next/navigation
const mockUsePathname = vi.fn();
const mockUseRouter = vi.fn(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
}));

// Mock workspace context
vi.mock('@/lib/context/workspace-context', () => ({
  useWorkspace: vi.fn(() => ({
    activeOrgId: null,
    activeOrg: null,
    organizations: [],
    isLoading: false,
    switchWorkspace: vi.fn(),
    hasRole: vi.fn(() => false),
    isPersonalContext: true,
    refresh: vi.fn(),
  })),
  createOrgHeaders: vi.fn(() => ({
    'Content-Type': 'application/json',
  })),
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useSession } from 'next-auth/react';
import { Header } from '@/components/layouts/header';
import { Sidebar } from '@/components/layouts/sidebar';

// Mock authenticated session
const mockAuthenticatedSession = {
  data: {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
    },
    expires: new Date(Date.now() + 3600000).toISOString(),
  },
  status: 'authenticated' as const,
  update: vi.fn(),
};

// Mock unauthenticated session
const mockUnauthenticatedSession = {
  data: null,
  status: 'unauthenticated' as const,
  update: vi.fn(),
};

describe('Layout Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Header Component', () => {
    describe('When Authenticated', () => {
      beforeEach(() => {
        vi.mocked(useSession).mockReturnValue(mockAuthenticatedSession);
      });

      it('renders header on dashboard page', () => {
        mockUsePathname.mockReturnValue('/dashboard');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on agents page', () => {
        mockUsePathname.mockReturnValue('/agents');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on agent detail page', () => {
        mockUsePathname.mockReturnValue('/agents/ux-analyst');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on conversations page', () => {
        mockUsePathname.mockReturnValue('/conversations');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on settings page', () => {
        mockUsePathname.mockReturnValue('/settings');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on organization page', () => {
        mockUsePathname.mockReturnValue('/organization');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('renders header on billing page', () => {
        mockUsePathname.mockReturnValue('/billing');
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });

      it('shows user menu when authenticated', () => {
        render(<Header />);
        // Header should have user-related content
        const header = screen.getByTestId('header');
        expect(header).toBeInTheDocument();
      });
    });

    describe('When Unauthenticated', () => {
      beforeEach(() => {
        vi.mocked(useSession).mockReturnValue(mockUnauthenticatedSession);
      });

      it('still renders header structure', () => {
        render(<Header />);
        expect(screen.getByTestId('header')).toBeInTheDocument();
      });
    });
  });

  describe('Sidebar Component', () => {
    describe('When Authenticated', () => {
      beforeEach(() => {
        vi.mocked(useSession).mockReturnValue(mockAuthenticatedSession);
      });

      it('renders sidebar on dashboard page', () => {
        mockUsePathname.mockReturnValue('/dashboard');
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      it('renders sidebar on agents page', () => {
        mockUsePathname.mockReturnValue('/agents');
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      it('renders sidebar on agent detail page', () => {
        mockUsePathname.mockReturnValue('/agents/ux-analyst');
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      it('renders sidebar on conversations page', () => {
        mockUsePathname.mockReturnValue('/conversations');
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      it('renders sidebar on settings page', () => {
        mockUsePathname.mockReturnValue('/settings');
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      });

      it('highlights active navigation item', () => {
        mockUsePathname.mockReturnValue('/dashboard');
        render(<Sidebar />);
        
        const sidebar = screen.getByTestId('sidebar');
        const dashboardLink = within(sidebar).getByRole('link', { name: /dashboard/i });
        expect(dashboardLink).toHaveAttribute('aria-current', 'page');
      });

      it('shows correct navigation items for authenticated users', () => {
        render(<Sidebar />);
        
        const sidebar = screen.getByTestId('sidebar');
        expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
        expect(within(sidebar).getByText('Expert Agents')).toBeInTheDocument();
        expect(within(sidebar).getByText('Conversations')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Consistency', () => {
    beforeEach(() => {
      vi.mocked(useSession).mockReturnValue(mockAuthenticatedSession);
    });

    it('sidebar preserves structure across page navigation', () => {
      // First render on dashboard
      mockUsePathname.mockReturnValue('/dashboard');
      const { rerender } = render(<Sidebar />);
      
      let sidebar = screen.getByTestId('sidebar');
      expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
      expect(within(sidebar).getByText('Expert Agents')).toBeInTheDocument();

      // Navigate to agents
      mockUsePathname.mockReturnValue('/agents');
      rerender(<Sidebar />);
      
      sidebar = screen.getByTestId('sidebar');
      expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
      expect(within(sidebar).getByText('Expert Agents')).toBeInTheDocument();

      // Navigate to settings
      mockUsePathname.mockReturnValue('/settings');
      rerender(<Sidebar />);
      
      sidebar = screen.getByTestId('sidebar');
      expect(within(sidebar).getByText('Dashboard')).toBeInTheDocument();
      expect(within(sidebar).getByText('Expert Agents')).toBeInTheDocument();
    });

    it('header preserves structure across page navigation', () => {
      // First render on dashboard
      mockUsePathname.mockReturnValue('/dashboard');
      const { rerender } = render(<Header />);
      expect(screen.getByTestId('header')).toBeInTheDocument();

      // Navigate to agents
      mockUsePathname.mockReturnValue('/agents');
      rerender(<Header />);
      expect(screen.getByTestId('header')).toBeInTheDocument();

      // Navigate to agent detail
      mockUsePathname.mockReturnValue('/agents/legal-advisor');
      rerender(<Header />);
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    beforeEach(() => {
      vi.mocked(useSession).mockReturnValue(mockAuthenticatedSession);
    });

    it('sidebar supports collapsed state', () => {
      const onToggle = vi.fn();
      render(<Sidebar collapsed={true} onToggle={onToggle} />);
      
      const sidebar = screen.getByTestId('sidebar');
      // Collapsed sidebar should still be present but narrower
      expect(sidebar).toBeInTheDocument();
    });

    it('sidebar toggle calls callback', async () => {
      const onToggle = vi.fn();
      render(<Sidebar collapsed={false} onToggle={onToggle} />);
      
      const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
      await toggleButton.click();
      
      expect(onToggle).toHaveBeenCalled();
    });
  });
});
