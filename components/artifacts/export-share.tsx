/**
 * Export Share Component
 *
 * Provides export (PDF, DOCX) and share functionality for reports/documents.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7
 * @see docs/DESIGN.md - Export & Share
 */

'use client';

import * as React from 'react';
import {
  Download,
  FileText,
  File,
  Share2,
  Link,
  Users,
  Star,
  StarOff,
  Copy,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'docx' | 'markdown';

/**
 * Share visibility options
 */
export type ShareVisibility = 'private' | 'team' | 'org' | 'public';

/**
 * Share link data
 */
export interface ShareLink {
  url: string;
  visibility: ShareVisibility;
  expiresAt?: string;
}

/**
 * Props for the ExportShare component
 */
export interface ExportShareProps {
  /** ID of the artifact to export/share */
  artifactId: string;
  /** Current share link if exists */
  shareLink?: ShareLink;
  /** Whether artifact is favorited */
  isFavorited?: boolean;
  /** Callback for export */
  onExport?: (format: ExportFormat) => Promise<string>;
  /** Callback for creating share link */
  onCreateShareLink?: (visibility: ShareVisibility) => Promise<ShareLink>;
  /** Callback for copying link */
  onCopyLink?: (url: string) => void;
  /** Callback for toggling favorite */
  onToggleFavorite?: () => Promise<void>;
  /** Callback for revoking share link */
  onRevokeShareLink?: () => Promise<void>;
  /** Available export formats */
  availableFormats?: ExportFormat[];
  /** Whether to show share options */
  showShareOptions?: boolean;
  /** Whether to show favorite option */
  showFavoriteOption?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Export button component
 */
function ExportButton({
  format,
  onExport,
  isExporting,
}: {
  format: ExportFormat;
  onExport: () => void;
  isExporting: boolean;
}) {
  const formatConfig = {
    pdf: { icon: FileText, label: 'PDF', color: 'text-red-500' },
    docx: { icon: File, label: 'Word', color: 'text-blue-500' },
    markdown: { icon: FileText, label: 'Markdown', color: 'text-gray-500' },
  };

  const config = formatConfig[format];
  const Icon = config.icon;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onExport}
      disabled={isExporting}
      className="gap-2"
      data-testid={`export-${format}`}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className={cn('h-4 w-4', config.color)} />
      )}
      {config.label}
    </Button>
  );
}

/**
 * Share modal component
 */
function ShareModal({
  isOpen,
  onClose,
  shareLink,
  onCreateShareLink,
  onCopyLink,
  onRevokeShareLink,
}: {
  isOpen: boolean;
  onClose: () => void;
  shareLink?: ShareLink;
  onCreateShareLink?: (visibility: ShareVisibility) => Promise<ShareLink>;
  onCopyLink?: (url: string) => void;
  onRevokeShareLink?: () => Promise<void>;
}) {
  const [isCreating, setIsCreating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [currentLink, setCurrentLink] = React.useState<ShareLink | undefined>(shareLink);

  React.useEffect(() => {
    setCurrentLink(shareLink);
  }, [shareLink]);

  const handleCreateLink = React.useCallback(async (visibility: ShareVisibility) => {
    if (!onCreateShareLink) return;
    
    setIsCreating(true);
    try {
      const link = await onCreateShareLink(visibility);
      setCurrentLink(link);
    } finally {
      setIsCreating(false);
    }
  }, [onCreateShareLink]);

  const handleCopy = React.useCallback(() => {
    if (!currentLink) return;
    
    navigator.clipboard.writeText(currentLink.url);
    onCopyLink?.(currentLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [currentLink, onCopyLink]);

  const handleRevoke = React.useCallback(async () => {
    if (!onRevokeShareLink) return;
    
    await onRevokeShareLink();
    setCurrentLink(undefined);
  }, [onRevokeShareLink]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="share-modal"
    >
      <div 
        className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Share</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Link section */}
        {currentLink ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={currentLink.url}
                readOnly
                className="flex-1"
                data-testid="share-link-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                data-testid="copy-link-button"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Visibility: <span className="font-medium">{currentLink.visibility}</span>
              </span>
              {onRevokeShareLink && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRevoke}
                  data-testid="revoke-link-button"
                >
                  Revoke Link
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a shareable link for this document
            </p>
            
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleCreateLink('private')}
                disabled={isCreating}
                data-testid="share-private"
              >
                <Link className="h-4 w-4" />
                Private Link (anyone with link)
              </Button>
              
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleCreateLink('team')}
                disabled={isCreating}
                data-testid="share-team"
              >
                <Users className="h-4 w-4" />
                Share with Team
              </Button>
              
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => handleCreateLink('org')}
                disabled={isCreating}
                data-testid="share-org"
              >
                <Users className="h-4 w-4" />
                Share with Organization
              </Button>
            </div>
            
            {isCreating && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ExportShare Component
 *
 * Provides export buttons and share functionality
 */
export function ExportShare({
  artifactId,
  shareLink,
  isFavorited = false,
  onExport,
  onCreateShareLink,
  onCopyLink,
  onToggleFavorite,
  onRevokeShareLink,
  availableFormats = ['pdf', 'docx'],
  showShareOptions = true,
  showFavoriteOption = true,
  className,
}: ExportShareProps) {
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);
  const [isTogglingFavorite, setIsTogglingFavorite] = React.useState(false);

  // Handle export
  const handleExport = React.useCallback(async (format: ExportFormat) => {
    if (!onExport) return;
    
    setExportingFormat(format);
    try {
      const downloadUrl = await onExport(format);
      // Trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setExportingFormat(null);
    }
  }, [onExport]);

  // Handle favorite toggle
  const handleToggleFavorite = React.useCallback(async () => {
    if (!onToggleFavorite) return;
    
    setIsTogglingFavorite(true);
    try {
      await onToggleFavorite();
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [onToggleFavorite]);

  return (
    <div 
      className={cn('flex items-center gap-2 flex-wrap', className)}
      data-testid="export-share"
    >
      {/* Export buttons */}
      <div className="flex items-center gap-2">
        <Download className="h-4 w-4 text-muted-foreground" />
        {availableFormats.map((format) => (
          <ExportButton
            key={format}
            format={format}
            onExport={() => handleExport(format)}
            isExporting={exportingFormat === format}
          />
        ))}
      </div>

      {/* Divider */}
      {(showShareOptions || showFavoriteOption) && (
        <div className="w-px h-6 bg-border" />
      )}

      {/* Share button */}
      {showShareOptions && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setIsShareModalOpen(true)}
          data-testid="share-button"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      )}

      {/* Favorite button */}
      {showFavoriteOption && onToggleFavorite && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleFavorite}
          disabled={isTogglingFavorite}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          data-testid="favorite-button"
        >
          {isTogglingFavorite ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isFavorited ? (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareLink={shareLink}
        onCreateShareLink={onCreateShareLink}
        onCopyLink={onCopyLink}
        onRevokeShareLink={onRevokeShareLink}
      />
    </div>
  );
}
