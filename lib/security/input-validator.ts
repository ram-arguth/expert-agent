/**
 * Input Validator
 *
 * Validates user inputs including file sizes, content types, and input limits.
 * Enforces security constraints to prevent abuse.
 *
 * @see docs/IMPEMENTATION.md - Phase 0.8 Security & Compliance
 */

/**
 * File size validation result
 */
export interface FileSizeValidationResult {
  valid: boolean;
  error?: string;
  maxSize: number;
  actualSize: number;
}

/**
 * Input validation result
 */
export interface InputValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * File size limits per plan (in bytes)
 */
export interface FileSizeLimits {
  maxFileSize: number;
  maxTotalUploadSize: number;
  maxFilesPerRequest: number;
}

/**
 * Default file size limits per tier
 */
export const DEFAULT_FILE_SIZE_LIMITS: Record<string, FileSizeLimits> = {
  free: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxTotalUploadSize: 25 * 1024 * 1024, // 25MB
    maxFilesPerRequest: 5,
  },
  pro: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxTotalUploadSize: 100 * 1024 * 1024, // 100MB
    maxFilesPerRequest: 10,
  },
  enterprise: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxTotalUploadSize: 500 * 1024 * 1024, // 500MB
    maxFilesPerRequest: 25,
  },
};

/**
 * Allowed file MIME types
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  // Archives (for certain workflows)
  'application/zip',
  // JSON
  'application/json',
];

/**
 * Blocked file extensions (security)
 */
export const BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.dll',
  '.so',
  '.dylib',
  '.app',
  '.dmg',
  '.pkg',
  '.msi',
  '.deb',
  '.rpm',
];

/**
 * Get file size limits for a plan
 */
export function getFileSizeLimits(plan?: string): FileSizeLimits {
  const normalizedPlan = plan?.toLowerCase() ?? 'free';
  return DEFAULT_FILE_SIZE_LIMITS[normalizedPlan] ?? DEFAULT_FILE_SIZE_LIMITS.free;
}

/**
 * Validate a single file's size
 */
export function validateFileSize(
  fileSize: number,
  plan?: string
): FileSizeValidationResult {
  const limits = getFileSizeLimits(plan);

  if (fileSize > limits.maxFileSize) {
    return {
      valid: false,
      error: `File size ${formatBytes(fileSize)} exceeds maximum ${formatBytes(limits.maxFileSize)}`,
      maxSize: limits.maxFileSize,
      actualSize: fileSize,
    };
  }

  return {
    valid: true,
    maxSize: limits.maxFileSize,
    actualSize: fileSize,
  };
}

/**
 * Validate total upload size
 */
export function validateTotalUploadSize(
  totalSize: number,
  plan?: string
): FileSizeValidationResult {
  const limits = getFileSizeLimits(plan);

  if (totalSize > limits.maxTotalUploadSize) {
    return {
      valid: false,
      error: `Total upload size ${formatBytes(totalSize)} exceeds maximum ${formatBytes(limits.maxTotalUploadSize)}`,
      maxSize: limits.maxTotalUploadSize,
      actualSize: totalSize,
    };
  }

  return {
    valid: true,
    maxSize: limits.maxTotalUploadSize,
    actualSize: totalSize,
  };
}

/**
 * Validate file count per request
 */
export function validateFileCount(
  count: number,
  plan?: string
): { valid: boolean; error?: string; maxFiles: number } {
  const limits = getFileSizeLimits(plan);

  if (count > limits.maxFilesPerRequest) {
    return {
      valid: false,
      error: `File count ${count} exceeds maximum ${limits.maxFilesPerRequest} files per request`,
      maxFiles: limits.maxFilesPerRequest,
    };
  }

  return {
    valid: true,
    maxFiles: limits.maxFilesPerRequest,
  };
}

/**
 * Validate file MIME type
 */
export function validateMimeType(
  mimeType: string
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Validate file extension
 */
export function validateFileExtension(
  filename: string
): { valid: boolean; error?: string } {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File extension "${ext}" is not allowed for security reasons`,
    };
  }

  return { valid: true };
}

/**
 * Validate text input length
 */
export function validateTextLength(
  text: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (text.length > maxLength) {
    return {
      valid: false,
      error: `Text length ${text.length} exceeds maximum ${maxLength} characters`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  file: { name: string; size: number; type: string },
  plan?: string
): InputValidationResult {
  const errors: string[] = [];

  // Size validation
  const sizeResult = validateFileSize(file.size, plan);
  if (!sizeResult.valid && sizeResult.error) {
    errors.push(sizeResult.error);
  }

  // MIME type validation
  const mimeResult = validateMimeType(file.type);
  if (!mimeResult.valid && mimeResult.error) {
    errors.push(mimeResult.error);
  }

  // Extension validation
  const extResult = validateFileExtension(file.name);
  if (!extResult.valid && extResult.error) {
    errors.push(extResult.error);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: Array<{ name: string; size: number; type: string }>,
  plan?: string
): InputValidationResult {
  const errors: string[] = [];
  const limits = getFileSizeLimits(plan);

  // File count validation
  const countResult = validateFileCount(files.length, plan);
  if (!countResult.valid && countResult.error) {
    errors.push(countResult.error);
  }

  // Total size validation
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalResult = validateTotalUploadSize(totalSize, plan);
  if (!totalResult.valid && totalResult.error) {
    errors.push(totalResult.error);
  }

  // Individual file validation
  files.forEach((file, index) => {
    const fileResult = validateFile(file, plan);
    fileResult.errors.forEach((error) => {
      errors.push(`File ${index + 1} (${file.name}): ${error}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
