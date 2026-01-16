/**
 * FileUploadProgress Component
 *
 * Displays file upload progress with status indicators.
 * Shows individual file progress bars and allows retry/remove actions.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.1 File Upload
 */

"use client";

import * as React from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  X,
  RotateCcw,
  FileText,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { UploadedFile } from "@/lib/hooks/use-file-upload";
import { formatFileSize } from "./file-uploader";

// =============================================================================
// Types
// =============================================================================

export interface FileUploadProgressProps {
  /** Files to display */
  files: UploadedFile[];
  /** Called when user wants to remove a file */
  onRemove?: (fileId: string) => void;
  /** Called when user wants to retry a failed upload */
  onRetry?: (fileId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper: File Icon
// =============================================================================

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

// =============================================================================
// Helper: Status Icon
// =============================================================================

function StatusIcon({ status }: { status: UploadedFile["status"] }) {
  switch (status) {
    case "complete":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "uploading":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    default:
      return null;
  }
}

// =============================================================================
// FileUploadProgress Component
// =============================================================================

export function FileUploadProgress({
  files,
  onRemove,
  onRetry,
  className,
}: FileUploadProgressProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("space-y-3", className)}
      data-testid="file-upload-progress"
    >
      {files.map((file) => (
        <div
          key={file.id}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3",
            file.status === "error" && "border-destructive/50 bg-destructive/5",
            file.status === "complete" && "border-green-500/30 bg-green-500/5",
          )}
          data-testid={`file-item-${file.id}`}
        >
          {/* Preview or Icon */}
          <div className="flex-shrink-0">
            {file.previewUrl ? (
              <img
                src={file.previewUrl}
                alt={file.file.name}
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                <FileIcon mimeType={file.file.type} />
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className="text-sm font-medium truncate"
                title={file.file.name}
              >
                {file.file.name}
              </p>
              <StatusIcon status={file.status} />
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.file.size)}
              </span>

              {file.status === "uploading" && (
                <span className="text-xs text-muted-foreground">
                  {file.progress}%
                </span>
              )}

              {file.status === "error" && file.error && (
                <span
                  className="text-xs text-destructive truncate"
                  title={file.error}
                >
                  {file.error}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {(file.status === "uploading" || file.status === "pending") && (
              <Progress
                value={file.progress}
                className="mt-2 h-1"
                data-testid={`progress-${file.id}`}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex gap-1">
            {file.status === "error" && onRetry && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onRetry(file.id)}
                aria-label={`Retry upload for ${file.file.name}`}
                data-testid={`retry-${file.id}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}

            {onRemove && file.status !== "uploading" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${file.file.name}`}
                data-testid={`remove-${file.id}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default FileUploadProgress;
