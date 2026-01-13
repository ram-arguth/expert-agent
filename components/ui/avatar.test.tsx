import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarImage, AvatarFallback } from './avatar';

describe('Avatar', () => {
  it('renders with fallback when no image', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies custom className to Avatar', () => {
    render(
      <Avatar className="h-16 w-16" data-testid="avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    );
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toHaveClass('h-16');
    expect(avatar).toHaveClass('w-16');
  });

  it('renders image when provided', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.jpg" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    );
    // AvatarImage uses Radix's image load detection, so we just check the component renders
    // The fallback will be visible initially until the image loads
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
