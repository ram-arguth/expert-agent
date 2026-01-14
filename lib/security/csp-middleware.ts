/**
 * Content Security Policy (CSP) Middleware
 *
 * Configures strict Content-Security-Policy headers to mitigate XSS attacks.
 * Disallows inline scripts and allows only trusted CDNs.
 *
 * @see docs/IMPEMENTATION.md - Phase 0.8 Security & Compliance
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP directive configuration
 */
export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-src': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'frame-ancestors': string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

/**
 * Trusted CDN domains for script/style loading
 */
export const TRUSTED_CDNS = [
  'https://cdn.jsdelivr.net',
  'https://unpkg.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/**
 * Trusted API endpoints
 */
export const TRUSTED_CONNECT_SOURCES = [
  "'self'",
  'https://*.googleapis.com',
  'https://*.google.com',
  'https://api.stripe.com',
  'https://sentry.io',
];

/**
 * Default CSP directives (strict)
 */
export const DEFAULT_CSP_DIRECTIVES: CSPDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'strict-dynamic'", ...TRUSTED_CDNS],
  'style-src': ["'self'", "'unsafe-inline'", ...TRUSTED_CDNS], // unsafe-inline needed for styled-components/emotion
  'img-src': ["'self'", 'data:', 'blob:', 'https://*.googleapis.com', 'https://*.gstatic.com'],
  'font-src': ["'self'", 'data:', ...TRUSTED_CDNS],
  'connect-src': TRUSTED_CONNECT_SOURCES,
  'frame-src': ["'self'", 'https://js.stripe.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'upgrade-insecure-requests': true,
  'block-all-mixed-content': true,
};

/**
 * Development CSP (more permissive for HMR/dev tools)
 */
export const DEV_CSP_DIRECTIVES: CSPDirectives = {
  ...DEFAULT_CSP_DIRECTIVES,
  'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'", ...TRUSTED_CDNS],
  'connect-src': [...TRUSTED_CONNECT_SOURCES, 'ws://localhost:*', 'wss://localhost:*'],
};

/**
 * Build CSP header string from directives
 */
export function buildCSPHeader(directives: CSPDirectives): string {
  const parts: string[] = [];

  for (const [directive, value] of Object.entries(directives)) {
    if (typeof value === 'boolean') {
      if (value) {
        parts.push(directive);
      }
    } else if (Array.isArray(value) && value.length > 0) {
      parts.push(`${directive} ${value.join(' ')}`);
    }
  }

  return parts.join('; ');
}

/**
 * Get CSP directives based on environment
 */
export function getCSPDirectives(isDevelopment: boolean = false): CSPDirectives {
  return isDevelopment ? DEV_CSP_DIRECTIVES : DEFAULT_CSP_DIRECTIVES;
}

/**
 * Add nonce to script-src for inline scripts (when needed)
 */
export function addNonceToCSP(directives: CSPDirectives, nonce: string): CSPDirectives {
  return {
    ...directives,
    'script-src': [`'nonce-${nonce}'`, ...directives['script-src']],
    'style-src': [`'nonce-${nonce}'`, ...directives['style-src']],
  };
}

/**
 * Generate a secure nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * CSP middleware for Next.js
 * Apply CSP headers to all responses
 */
export function cspMiddleware(
  request: NextRequest,
  response: NextResponse,
  options?: { nonce?: string; isDevelopment?: boolean }
): NextResponse {
  const isDev = options?.isDevelopment ?? process.env.NODE_ENV === 'development';
  let directives = getCSPDirectives(isDev);

  // Add nonce if provided
  if (options?.nonce) {
    directives = addNonceToCSP(directives, options.nonce);
  }

  const cspHeader = buildCSPHeader(directives);

  // Set CSP header
  response.headers.set('Content-Security-Policy', cspHeader);

  // Add other security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

/**
 * Create security headers object for API routes
 */
export function getSecurityHeaders(options?: {
  nonce?: string;
  isDevelopment?: boolean;
}): Record<string, string> {
  const isDev = options?.isDevelopment ?? process.env.NODE_ENV === 'development';
  let directives = getCSPDirectives(isDev);

  if (options?.nonce) {
    directives = addNonceToCSP(directives, options.nonce);
  }

  return {
    'Content-Security-Policy': buildCSPHeader(directives),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

/**
 * Validate that a URL is from a trusted source
 */
export function isTrustedSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Check if it's self
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Check trusted CDNs
    for (const cdn of TRUSTED_CDNS) {
      const cdnHost = new URL(cdn).hostname;
      if (hostname === cdnHost) {
        return true;
      }
    }

    // Check trusted connect sources
    for (const source of TRUSTED_CONNECT_SOURCES) {
      if (source === "'self'") continue;
      
      const pattern = source.replace('https://', '').replace('*', '.*');
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(hostname)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Report CSP violation (for logging/monitoring)
 */
export interface CSPViolationReport {
  'document-uri': string;
  'violated-directive': string;
  'blocked-uri': string;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
}

/**
 * Log CSP violation for monitoring
 */
export function logCSPViolation(report: CSPViolationReport): void {
  console.warn('[CSP Violation]', {
    documentUri: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedUri: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  });
}
