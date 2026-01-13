'use client';

/**
 * FileUploader Component
 *
 * A drag-and-drop file upload zone with validation and preview support.
 */

import * as React from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Represents an uploaded file with metadata
 */
export interface UploadedFile {
  /** Unique identifier for this file */
  id: string;
  /** Original File object */
  file: File;
  /** User-provided label (optional) */
  label?: string;
  /** Upload status */
  status: 'pending' | 'uploading' | 'complete' | 'error';
  /** Upload progress (0-100) */
  progress: number;
  /** Error message if status is error */
  error?: string;
  /** Preview URL for images */
  previewUrl?: string;
}

export interface FileUploaderProps {
  /** Called when files are added */
  onFilesAdded: (files: UploadedFile[]) => void;
  /** Accepted MIME types */
  acceptedTypes?: string[];
  /** Maximum file size in MB */
  maxSizeMB?: number;
  /** Maximum number of files */
  maxFiles?: number;
  /** Currently uploaded files (for showing count) */
  currentFileCount?: number;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Default accepted file types */
const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

/** Default max file size (10MB) */
const DEFAULT_MAX_SIZE_MB = 10;

/** Default max files */
const DEFAULT_MAX_FILES = 10;

/**
 * Generate a unique ID for a file
 */
function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate a single file against constraints
 */
function validateFile(file: File, acceptedTypes: string[], maxSizeMB: number): string | null {
  if (!acceptedTypes.includes(file.type)) {
    return `Invalid file type. Accepted: ${acceptedTypes.map((t) => t.split('/')[1]).join(', ')}`;
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `File too large. Maximum size: ${maxSizeMB}MB`;
  }

  return null;
}

/**
 * Create a preview URL for image files
 */
function createPreviewUrl(file: File): string | undefined {
  if (file.type.startsWith('image/')) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

export function FileUploader({
  onFilesAdded,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  maxFiles = DEFAULT_MAX_FILES,
  currentFileCount = 0,
  disabled = false,
  className,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const remainingSlots = maxFiles - currentFileCount;
  const canAddFiles = remainingSlots > 0 && !disabled;

  const processFiles = React.useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList);
      const errors: string[] = [];
      const validFiles: UploadedFile[] = [];

      if (files.length > remainingSlots) {
        errors.push(`Maximum ${maxFiles} files allowed. You can add ${remainingSlots} more.`);
      }

      const filesToProcess = files.slice(0, remainingSlots);
      for (const file of filesToProcess) {
        const error = validateFile(file, acceptedTypes, maxSizeMB);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push({
            id: generateFileId(),
            file,
            status: 'pending',
            progress: 0,
            previewUrl: createPreviewUrl(file),
          });
        }
      }

      setValidationErrors(errors);
      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [acceptedTypes, maxSizeMB, maxFiles, remainingSlots, onFilesAdded]
  );

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (canAddFiles) {
        setIsDragOver(true);
      }
    },
    [canAddFiles]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!canAddFiles) return;

      const { files } = e.dataTransfer;
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [canAddFiles, processFiles]
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles]
  );

  const handleClick = React.useCallback(() => {
    if (canAddFiles) {
      inputRef.current?.click();
    }
  }, [canAddFiles]);

  const clearErrors = React.useCallback(() => {
    setValidationErrors([]);
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center',
          'rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
          disabled && 'cursor-not-allowed opacity-50',
          !canAddFiles && !disabled && 'cursor-not-allowed'
        )}
        role="button"
        tabIndex={canAddFiles ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Upload files"
        data-testid="file-uploader"
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={!canAddFiles}
          data-testid="file-input"
        />

        {/* Upload icon */}
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full',
            isDragOver ? 'bg-primary/20' : 'bg-muted'
          )}
        >
          <Upload
            className={cn('h-8 w-8', isDragOver ? 'text-primary' : 'text-muted-foreground')}
          />
        </div>

        {/* Text content */}
        <div className="text-center">
          <p className="font-medium">
            {isDragOver ? (
              'Drop files here'
            ) : (
              <>
                Drag & drop files or <span className="text-primary">browse</span>
              </>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            PNG, JPEG, WebP, GIF, or PDF (max {maxSizeMB}MB each)
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {remainingSlots > 0
              ? `You can add ${remainingSlots} more file${remainingSlots !== 1 ? 's' : ''}`
              : 'Maximum files reached'}
          </p>
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div
          className="border-destructive/50 bg-destructive/10 rounded-md border p-4"
          data-testid="upload-errors"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="text-destructive text-sm font-medium">Some files could not be added:</p>
              <ul className="text-destructive/90 mt-2 list-inside list-disc text-sm">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearErrors}
              className="h-6 w-6 shrink-0"
              aria-label="Dismiss errors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
