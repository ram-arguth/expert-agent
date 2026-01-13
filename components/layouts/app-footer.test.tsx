import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  it('renders copyright with current year', () => {
    render(<AppFooter />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear}`))).toBeInTheDocument();
  });

  it('renders Expert AI brand name', () => {
    render(<AppFooter />);
    expect(screen.getByText(/expert ai/i)).toBeInTheDocument();
  });

  it('renders footer navigation links', () => {
    render(<AppFooter />);
    expect(screen.getByRole('link', { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /docs/i })).toBeInTheDocument();
  });

  it('has correct href attributes', () => {
    render(<AppFooter />);
    expect(screen.getByRole('link', { name: /terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /support/i })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: /docs/i })).toHaveAttribute('href', '/docs');
  });
});
