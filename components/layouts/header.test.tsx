import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from './header';

describe('Header', () => {
  const mockUser = {
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
  };

  it('shows login/signup buttons when no user', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });

  it('shows user menu when user is logged in', () => {
    render(<Header user={mockUser} />);
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<Header isLoading />);
    // Should show skeleton elements, not login buttons or user menu
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
  });

  it('shows search input when showSearch is true', () => {
    render(<Header showSearch user={mockUser} />);
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
  });

  it('hides search input when showSearch is false', () => {
    render(<Header showSearch={false} user={mockUser} />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('calls onMenuClick when menu button is clicked', () => {
    const onMenuClick = vi.fn();
    render(<Header onMenuClick={onMenuClick} user={mockUser} />);
    const menuButton = screen.getByRole('button', { name: /toggle menu/i });
    fireEvent.click(menuButton);
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('shows context switcher when contexts are provided', () => {
    const contexts = [
      { id: 'personal', name: 'Personal', type: 'personal' as const },
      { id: 'team-1', name: 'Acme Team', type: 'team' as const },
    ];
    const onContextChange = vi.fn();
    render(
      <Header
        user={mockUser}
        contexts={contexts}
        currentContext="personal"
        onContextChange={onContextChange}
      />
    );
    expect(screen.getByRole('button', { name: /personal/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Header className="custom-class" user={mockUser} />);
    const header = screen.getByTestId('header');
    expect(header).toHaveClass('custom-class');
  });
});
