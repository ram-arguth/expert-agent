import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './sidebar';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

describe('Sidebar', () => {
  it('renders with default navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Expert Agents')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('shows organization items when showOrgItems is true', () => {
    render(<Sidebar showOrgItems />);
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('does not show organization items by default', () => {
    render(<Sidebar />);
    expect(screen.queryByText('Organization')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
  });

  it('highlights the active navigation item', () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-primary');
  });

  it('collapses when collapsed prop is true', () => {
    render(<Sidebar collapsed />);
    // When collapsed, text labels should not be visible
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('calls onToggle when collapse button is clicked', () => {
    const onToggle = vi.fn();
    render(<Sidebar onToggle={onToggle} />);
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleButton);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows logo with Expert AI text', () => {
    render(<Sidebar />);
    expect(screen.getByText('Expert AI')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Sidebar className="custom-class" />);
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveClass('custom-class');
  });
});
