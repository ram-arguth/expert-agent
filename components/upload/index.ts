/**
 * Upload Components and Hooks
 *
 * Re-exports all upload-related components and hooks for easier importing.
 *
 * @example
 * import { useFileUpload, FileUploader, FileUploadProgress } from '@/components/upload';
 */

export { FileUploader, formatFileSize } from './file-uploader';
export type { UploadedFile as UploaderFile, FileUploaderProps } from './file-uploader';

export { FileUploadProgress } from './file-upload-progress';
export type { FileUploadProgressProps } from './file-upload-progress';

// Re-export hook and types from lib
export { useFileUpload } from '@/lib/hooks/use-file-upload';
export type {
  UploadedFile,
  UploadOptions,
  UploadResult,
  UseFileUploadReturn,
} from '@/lib/hooks/use-file-upload';
