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

// CSP Middleware
export {
  buildCSPHeader,
  getCSPDirectives,
  addNonceToCSP,
  generateNonce,
  cspMiddleware,
  getSecurityHeaders,
  isTrustedSource,
  logCSPViolation,
  DEFAULT_CSP_DIRECTIVES,
  DEV_CSP_DIRECTIVES,
  TRUSTED_CDNS,
  TRUSTED_CONNECT_SOURCES,
} from './csp-middleware';
export type { CSPDirectives, CSPViolationReport } from './csp-middleware';

// Circuit Breaker
export {
  recordSpend,
  isSuspended,
  getCurrentSpend,
  getState,
  setAdminOverride,
  getAdminOverride,
  removeAdminOverride,
  suspendAccount,
  unsuspendAccount,
  getAlerts,
  onAlert,
  resetCircuitBreaker,
  estimateCostFromTokens,
  DEFAULT_THRESHOLDS,
} from './circuit-breaker';
export type {
  SpendThreshold,
  CircuitBreakerState,
  AlertRecord,
  AdminOverride,
} from './circuit-breaker';
