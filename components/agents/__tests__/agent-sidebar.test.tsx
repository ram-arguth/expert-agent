/**
 * Agent Sidebar Component Tests
 *
 * Comprehensive tests for agent sidebar including:
 * - Data loading from API
 * - Category grouping
 * - Active state highlighting
 * - Badge display
 * - Loading and error states
 * - Security and accessibility
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSidebar } from '../agent-sidebar';

// Mock next/navigation
const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
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
  createOrgHeaders: vi.fn((orgId: string | null) => ({
    'Content-Type': 'application/json',
    ...(orgId ? { 'X-Active-Org': orgId } : {}),
  })),
}));

// Sample agent data
const mockAgents = [
  {
    id: 'ux-analyst',
    name: 'UX Analyst',
    description: 'Analyze UX designs',
    category: 'Design',
    isBeta: false,
    isNew: true,
  },
  {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    description: 'Legal document review',
    category: 'Legal',
    isBeta: true,
    isNew: false,
  },
  {
    id: 'ui-reviewer',
    name: 'UI Reviewer',
    description: 'Review UI components',
    category: 'Design',
    isBeta: false,
    isNew: false,
  },
];

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentSidebar', () => {
  beforeEach(() => {
    // Reset all mocks completely before each test
    mockFetch.mockReset();
    mockUsePathname.mockReset();
    
    // Set default mock implementations
    mockUsePathname.mockReturnValue('/agents');
    mockFetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ agents: mockAgents }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Data Loading', () => {
    it('shows loading state initially', async () => {
      // Delay the response to see loading state
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ agents: mockAgents }),
                }),
              100
            )
          )
      );

      render(<AgentSidebar />);

      // Should show loading skeletons
      await waitFor(() => {
        expect(screen.getByTestId('agent-sidebar')).toBeInTheDocument();
      });
    });

    it('renders agents from API', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('UX Analyst')).toBeInTheDocument();
        expect(screen.getByText('Legal Advisor')).toBeInTheDocument();
        expect(screen.getByText('UI Reviewer')).toBeInTheDocument();
      });
    });

    it('groups agents by category', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        // Check category headers exist
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Legal')).toBeInTheDocument();
      });
    });

    it('shows error state when API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load agents')).toBeInTheDocument();
      });
    });

    it('shows empty state when no agents available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agents: [] }),
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('No agents available')).toBeInTheDocument();
      });
    });
  });

  describe('Badge Display', () => {
    it('shows Beta badge for beta agents', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Beta')).toBeInTheDocument();
      });
    });

    it('shows New badge for new agents', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });

    it('shows both badges when agent is beta and new', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          agents: [
            {
              id: 'test-agent',
              name: 'Test Agent',
              description: 'Test',
              category: 'Test',
              isBeta: true,
              isNew: true,
            },
          ],
        }),
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
      });
    });
  });

  describe('Active State', () => {
    it('highlights active agent based on URL', async () => {
      mockUsePathname.mockReturnValue('/agents/ux-analyst');

      render(<AgentSidebar />);

      await waitFor(() => {
        const activeLink = screen.getByRole('link', { name: /ux analyst/i });
        expect(activeLink).toHaveAttribute('aria-current', 'page');
      });
    });

    it('does not highlight non-active agents', async () => {
      mockUsePathname.mockReturnValue('/agents/ux-analyst');

      render(<AgentSidebar />);

      await waitFor(() => {
        const inactiveLink = screen.getByRole('link', { name: /legal advisor/i });
        expect(inactiveLink).not.toHaveAttribute('aria-current');
      });
    });
  });

  describe('Navigation', () => {
    it('links to correct agent pages', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        const uxAnalystLink = screen.getByRole('link', { name: /ux analyst/i });
        expect(uxAnalystLink).toHaveAttribute('href', '/agents/ux-analyst');

        const legalAdvisorLink = screen.getByRole('link', { name: /legal advisor/i });
        expect(legalAdvisorLink).toHaveAttribute('href', '/agents/legal-advisor');
      });
    });

    it('calls onSelectAgent callback when agent is clicked', async () => {
      const user = userEvent.setup();
      const onSelectAgent = vi.fn();

      render(<AgentSidebar onSelectAgent={onSelectAgent} />);

      await waitFor(() => {
        expect(screen.getByText('UX Analyst')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('link', { name: /ux analyst/i }));

      expect(onSelectAgent).toHaveBeenCalledWith('ux-analyst');
    });

    it('includes browse all link', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Browse all agents →')).toBeInTheDocument();
        expect(screen.getByText('Browse all agents →')).toHaveAttribute(
          'href',
          '/agents'
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible navigation landmark', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByRole('navigation', { name: 'Agent navigation' })).toBeInTheDocument();
      });
    });

    it('uses appropriate ARIA attributes for active state', async () => {
      mockUsePathname.mockReturnValue('/agents/ux-analyst');

      render(<AgentSidebar />);

      await waitFor(() => {
        const activeLink = screen.getByRole('link', { name: /ux analyst/i });
        expect(activeLink).toHaveAttribute('aria-current', 'page');
      });
    });

    it('has descriptive testid for automation', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByTestId('agent-sidebar')).toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    it('makes authenticated API request', async () => {
      render(<AgentSidebar />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/agents',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    it('handles malformed API response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unexpectedField: 'data' }),
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        // Should show empty state instead of crashing
        expect(screen.getByText('No agents available')).toBeInTheDocument();
      });
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<AgentSidebar />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Category Sorting', () => {
    it('sorts categories alphabetically', async () => {
      const categorizedAgents = [
        { id: '1', name: 'Zebra Agent', category: 'Zebra', description: '' },
        { id: '2', name: 'Alpha Agent', category: 'Alpha', description: '' },
        { id: '3', name: 'Mid Agent', category: 'Middle', description: '' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agents: categorizedAgents }),
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        const categoryHeaders = screen.getAllByText(/^(alpha|middle|zebra)$/i);
        expect(categoryHeaders[0]).toHaveTextContent('Alpha');
        expect(categoryHeaders[1]).toHaveTextContent('Middle');
        expect(categoryHeaders[2]).toHaveTextContent('Zebra');
      });
    });

    it('puts Featured category first', async () => {
      const categorizedAgents = [
        { id: '1', name: 'Zebra Agent', category: 'Zebra', description: '' },
        { id: '2', name: 'Featured Agent', category: 'Featured', description: '' },
        { id: '3', name: 'Alpha Agent', category: 'Alpha', description: '' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agents: categorizedAgents }),
      });

      render(<AgentSidebar />);

      await waitFor(() => {
        const categoryHeaders = screen.getAllByText(/^(alpha|featured|zebra)$/i);
        expect(categoryHeaders[0]).toHaveTextContent('Featured');
      });
    });
  });
});
