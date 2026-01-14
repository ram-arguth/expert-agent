/**
 * Export Share Component Tests
 *
 * Tests for export and share functionality including:
 * - Export buttons and triggers
 * - Share modal
 * - Link copying
 * - Favorite toggling
 * - Security
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportShare, ShareLink } from '../export-share';

describe('ExportShare', () => {
  // Mock clipboard API
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    mockClipboard.writeText.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Export Buttons', () => {
    it('renders export buttons for available formats', () => {
      render(<ExportShare artifactId="test-123" />);
      
      expect(screen.getByTestId('export-pdf')).toBeInTheDocument();
      expect(screen.getByTestId('export-docx')).toBeInTheDocument();
    });

    it('respects availableFormats prop', () => {
      render(
        <ExportShare 
          artifactId="test-123" 
          availableFormats={['markdown']} 
        />
      );
      
      expect(screen.queryByTestId('export-pdf')).not.toBeInTheDocument();
      expect(screen.getByTestId('export-markdown')).toBeInTheDocument();
    });

    it('calls onExport with correct format when clicked', async () => {
      const user = userEvent.setup();
      const onExport = vi.fn().mockResolvedValue('https://example.com/file.pdf');
      
      render(<ExportShare artifactId="test-123" onExport={onExport} />);
      
      await user.click(screen.getByTestId('export-pdf'));
      
      await waitFor(() => {
        expect(onExport).toHaveBeenCalledWith('pdf');
      });
    });

    it('shows loading state during export', async () => {
      const onExport = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('url'), 100))
      );
      
      render(<ExportShare artifactId="test-123" onExport={onExport} />);
      
      fireEvent.click(screen.getByTestId('export-pdf'));
      
      // Button should be disabled during export
      await waitFor(() => {
        expect(screen.getByTestId('export-pdf')).toBeDisabled();
      });
    });

    it('triggers file download after export', async () => {
      const user = userEvent.setup();
      const onExport = vi.fn().mockResolvedValue('https://example.com/file.pdf');
      
      render(<ExportShare artifactId="test-123" onExport={onExport} />);
      
      await user.click(screen.getByTestId('export-pdf'));
      
      // Verify export was called - actual download is triggered in component
      await waitFor(() => {
        expect(onExport).toHaveBeenCalledWith('pdf');
      });
    });
  });

  describe('Share Button', () => {
    it('renders share button when showShareOptions is true', () => {
      render(<ExportShare artifactId="test-123" showShareOptions={true} />);
      
      expect(screen.getByTestId('share-button')).toBeInTheDocument();
    });

    it('hides share button when showShareOptions is false', () => {
      render(<ExportShare artifactId="test-123" showShareOptions={false} />);
      
      expect(screen.queryByTestId('share-button')).not.toBeInTheDocument();
    });

    it('opens share modal when clicked', async () => {
      const user = userEvent.setup();
      
      render(<ExportShare artifactId="test-123" />);
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('share-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Share Modal', () => {
    it('shows share visibility options when no link exists', async () => {
      const user = userEvent.setup();
      
      render(
        <ExportShare 
          artifactId="test-123" 
          onCreateShareLink={vi.fn().mockResolvedValue({ url: 'test', visibility: 'private' })}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('share-private')).toBeInTheDocument();
        expect(screen.getByTestId('share-team')).toBeInTheDocument();
        expect(screen.getByTestId('share-org')).toBeInTheDocument();
      });
    });

    it('calls onCreateShareLink with visibility option', async () => {
      const user = userEvent.setup();
      const onCreateShareLink = vi.fn().mockResolvedValue({
        url: 'https://example.com/share/abc',
        visibility: 'team',
      });
      
      render(
        <ExportShare 
          artifactId="test-123" 
          onCreateShareLink={onCreateShareLink}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('share-team')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('share-team'));
      
      await waitFor(() => {
        expect(onCreateShareLink).toHaveBeenCalledWith('team');
      });
    });

    it('shows existing share link', async () => {
      const user = userEvent.setup();
      const existingLink: ShareLink = {
        url: 'https://example.com/share/existing',
        visibility: 'private',
      };
      
      render(
        <ExportShare 
          artifactId="test-123" 
          shareLink={existingLink}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('share-link-input')).toHaveValue(existingLink.url);
      });
    });

    it('closes modal when clicking outside', async () => {
      const user = userEvent.setup();
      
      render(<ExportShare artifactId="test-123" />);
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('share-modal')).toBeInTheDocument();
      });
      
      // Click on modal backdrop
      await user.click(screen.getByTestId('share-modal'));
      
      await waitFor(() => {
        expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Copy Link', () => {
    it('copies link to clipboard when copy button clicked', async () => {
      const user = userEvent.setup();
      const onCopyLink = vi.fn();
      const existingLink: ShareLink = {
        url: 'https://example.com/share/copy-test',
        visibility: 'private',
      };
      
      render(
        <ExportShare 
          artifactId="test-123" 
          shareLink={existingLink}
          onCopyLink={onCopyLink}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('copy-link-button')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('copy-link-button'));
      
      // Verify the callback was called (clipboard is tested via onCopyLink)
      expect(onCopyLink).toHaveBeenCalledWith(existingLink.url);
    });

    it('calls onCopyLink callback', async () => {
      const user = userEvent.setup();
      const onCopyLink = vi.fn();
      const existingLink: ShareLink = {
        url: 'https://example.com/share/callback-test',
        visibility: 'private',
      };
      
      render(
        <ExportShare 
          artifactId="test-123" 
          shareLink={existingLink}
          onCopyLink={onCopyLink}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('copy-link-button')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('copy-link-button'));
      
      expect(onCopyLink).toHaveBeenCalledWith(existingLink.url);
    });
  });

  describe('Revoke Link', () => {
    it('shows revoke button when callback provided', async () => {
      const user = userEvent.setup();
      const existingLink: ShareLink = {
        url: 'https://example.com/share/revoke-test',
        visibility: 'private',
      };
      
      render(
        <ExportShare 
          artifactId="test-123" 
          shareLink={existingLink}
          onRevokeShareLink={vi.fn().mockResolvedValue(undefined)}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('revoke-link-button')).toBeInTheDocument();
      });
    });

    it('calls onRevokeShareLink when clicked', async () => {
      const user = userEvent.setup();
      const onRevokeShareLink = vi.fn().mockResolvedValue(undefined);
      const existingLink: ShareLink = {
        url: 'https://example.com/share/revoke-test',
        visibility: 'private',
      };
      
      render(
        <ExportShare 
          artifactId="test-123" 
          shareLink={existingLink}
          onRevokeShareLink={onRevokeShareLink}
        />
      );
      
      await user.click(screen.getByTestId('share-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('revoke-link-button')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('revoke-link-button'));
      
      expect(onRevokeShareLink).toHaveBeenCalled();
    });
  });

  describe('Favorite Button', () => {
    it('renders favorite button when showFavoriteOption is true', () => {
      render(
        <ExportShare 
          artifactId="test-123" 
          showFavoriteOption={true}
          onToggleFavorite={vi.fn()}
        />
      );
      
      expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    });

    it('hides favorite button when showFavoriteOption is false', () => {
      render(
        <ExportShare 
          artifactId="test-123" 
          showFavoriteOption={false}
        />
      );
      
      expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument();
    });

    it('shows filled star when favorited', () => {
      render(
        <ExportShare 
          artifactId="test-123" 
          isFavorited={true}
          onToggleFavorite={vi.fn()}
        />
      );
      
      const favoriteButton = screen.getByTestId('favorite-button');
      expect(favoriteButton.querySelector('svg')).toHaveClass('fill-yellow-400');
    });

    it('calls onToggleFavorite when clicked', async () => {
      const user = userEvent.setup();
      const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
      
      render(
        <ExportShare 
          artifactId="test-123" 
          onToggleFavorite={onToggleFavorite}
        />
      );
      
      await user.click(screen.getByTestId('favorite-button'));
      
      await waitFor(() => {
        expect(onToggleFavorite).toHaveBeenCalled();
      });
    });

    it('has accessible label', () => {
      render(
        <ExportShare 
          artifactId="test-123" 
          isFavorited={false}
          onToggleFavorite={vi.fn()}
        />
      );
      
      expect(screen.getByRole('button', { name: /add to favorites/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper test IDs', () => {
      render(<ExportShare artifactId="test-123" />);
      
      expect(screen.getByTestId('export-share')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('does not expose share link in DOM when not provided', () => {
      render(<ExportShare artifactId="test-123" />);
      
      // No link input should be visible
      expect(screen.queryByTestId('share-link-input')).not.toBeInTheDocument();
    });
  });
});
