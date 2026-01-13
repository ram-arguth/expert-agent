/**
 * Unit Tests: Workspace Switcher Component
 *
 * @see docs/IMPEMENTATION.md - Phase 1.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceSwitcher } from './workspace-switcher';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WorkspaceSwitcher', () => {
  const mockOrganizations = [
    {
      id: 'org-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      type: 'TEAM' as const,
      plan: 'pro',
      role: 'OWNER' as const,
    },
    {
      id: 'org-2',
      name: 'Beta Team',
      slug: 'beta-team',
      type: 'TEAM' as const,
      plan: 'free',
      role: 'MEMBER' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ organizations: mockOrganizations }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with Personal workspace selected by default', async () => {
    const onSwitch = vi.fn();
    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows organization name when org is selected', async () => {
    const onSwitch = vi.fn();
    render(
      <WorkspaceSwitcher
        activeOrgId="org-1"
        onSwitch={onSwitch}
        userName="Test User"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('opens dropdown and shows organizations when clicked', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    // Click the trigger button
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Wait for organizations to load
    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Team')).toBeInTheDocument();
    });
  });

  it('shows role badges for organizations', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('owner')).toBeInTheDocument();
      expect(screen.getByText('member')).toBeInTheDocument();
    });
  });

  it('calls onSwitch with null when Personal is selected', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId="org-1" onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    // Click Personal menu item
    const personalItem = screen.getByRole('menuitem', { name: /personal/i });
    await user.click(personalItem);

    expect(onSwitch).toHaveBeenCalledWith(null);
  });

  it('calls onSwitch with org ID when organization is selected', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    // Click Acme Corp
    const acmeItem = screen.getByRole('menuitem', { name: /acme corp/i });
    await user.click(acmeItem);

    expect(onSwitch).toHaveBeenCalledWith('org-1');
  });

  it('shows loading state while fetching organizations', async () => {
    // Delay the mock fetch
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ organizations: mockOrganizations }),
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    // Should show loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load organizations')).toBeInTheDocument();
    });
  });

  it('shows check mark next to currently selected workspace', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId="org-1" onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      // Check mark should be visible for Acme Corp
      const checkMarks = screen.getAllByLabelText('Currently selected');
      expect(checkMarks).toHaveLength(1);
    });
  });

  it('includes Create new team option', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Create new team')).toBeInTheDocument();
    });
  });

  it('handles empty organizations list gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ organizations: [] }),
    });

    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      // Should still show Personal (multiple instances - button and menu item) and Create option
      const personalElements = screen.getAllByText('Personal');
      expect(personalElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Create new team')).toBeInTheDocument();
    });
  });

  it('has accessible labels', () => {
    const onSwitch = vi.fn();
    render(
      <WorkspaceSwitcher activeOrgId={null} onSwitch={onSwitch} userName="Test User" />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-label');
    expect(trigger.getAttribute('aria-label')).toContain('Current workspace');
  });
});
