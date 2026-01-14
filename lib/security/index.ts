/**
 * Security Module Index
 *
 * Exports security-related utilities
 */

// Rate Limiter
export {
  checkRateLimit,
  resetRateLimiter,
  userRateLimitKey,
  orgRateLimitKey,
  ipRateLimitKey,
  getTierFromPlan,
  checkRateLimitWithHeaders,
  DEFAULT_RATE_LIMITS,
} from './rate-limiter';
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitTier,
  RateLimitMiddlewareOptions,
} from './rate-limiter';

// Input Validator
export {
  validateFileSize,
  validateTotalUploadSize,
  validateFileCount,
  validateMimeType,
  validateFileExtension,
  validateTextLength,
  validateFile,
  validateFiles,
  getFileSizeLimits,
  formatBytes,
  DEFAULT_FILE_SIZE_LIMITS,
  ALLOWED_MIME_TYPES,
  BLOCKED_EXTENSIONS,
} from './input-validator';
export type {
  FileSizeValidationResult,
  InputValidationResult,
  FileSizeLimits,
} from './input-validator';
