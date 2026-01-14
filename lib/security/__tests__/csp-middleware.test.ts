/**
 * CSP Middleware Tests
 *
 * Tests for Content Security Policy middleware including:
 * - CSP header generation
 * - Security directives
 * - Nonce handling
 * - Trusted sources
 *
 * @see docs/IMPEMENTATION.md - Phase 0.7 Test Requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
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
} from '../csp-middleware';

// Mock Next.js request/response
function createMockRequest(url: string = 'http://localhost:3000'): NextRequest {
  return new NextRequest(url);
}

function createMockResponse(): NextResponse {
  return new NextResponse();
}

describe('CSP Middleware', () => {
  describe('buildCSPHeader', () => {
    it('sets correct CSP headers', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      expect(header).toContain("default-src 'self'");
      expect(header).toContain('script-src');
      expect(header).toContain('style-src');
      expect(header).toContain("object-src 'none'");
    });

    it('includes boolean directives correctly', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      expect(header).toContain('upgrade-insecure-requests');
      expect(header).toContain('block-all-mixed-content');
    });

    it('separates directives with semicolons', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);
      const parts = header.split('; ');

      expect(parts.length).toBeGreaterThan(5);
    });
  });

  describe('DEFAULT_CSP_DIRECTIVES', () => {
    it('blocks inline scripts in CSP', () => {
      // Production CSP should NOT have 'unsafe-inline' for scripts
      expect(DEFAULT_CSP_DIRECTIVES['script-src']).not.toContain("'unsafe-inline'");
    });

    it('allows trusted CDNs', () => {
      const scriptSrc = DEFAULT_CSP_DIRECTIVES['script-src'];

      TRUSTED_CDNS.forEach((cdn) => {
        expect(scriptSrc).toContain(cdn);
      });
    });

    it('blocks object embeds', () => {
      expect(DEFAULT_CSP_DIRECTIVES['object-src']).toEqual(["'none'"]);
    });

    it('restricts frame ancestors', () => {
      expect(DEFAULT_CSP_DIRECTIVES['frame-ancestors']).toContain("'self'");
    });

    it('includes self for default-src', () => {
      expect(DEFAULT_CSP_DIRECTIVES['default-src']).toContain("'self'");
    });
  });

  describe('DEV_CSP_DIRECTIVES', () => {
    it('allows unsafe-eval in development for HMR', () => {
      expect(DEV_CSP_DIRECTIVES['script-src']).toContain("'unsafe-eval'");
    });

    it('allows websocket connections for dev server', () => {
      expect(DEV_CSP_DIRECTIVES['connect-src']).toContain('ws://localhost:*');
    });
  });

  describe('getCSPDirectives', () => {
    it('returns production directives by default', () => {
      const directives = getCSPDirectives(false);
      expect(directives['script-src']).not.toContain("'unsafe-eval'");
    });

    it('returns development directives when isDevelopment is true', () => {
      const directives = getCSPDirectives(true);
      expect(directives['script-src']).toContain("'unsafe-eval'");
    });
  });

  describe('addNonceToCSP', () => {
    it('adds nonce to script-src', () => {
      const nonce = 'test-nonce-123';
      const directives = addNonceToCSP(DEFAULT_CSP_DIRECTIVES, nonce);

      expect(directives['script-src']).toContain(`'nonce-${nonce}'`);
    });

    it('adds nonce to style-src', () => {
      const nonce = 'test-nonce-456';
      const directives = addNonceToCSP(DEFAULT_CSP_DIRECTIVES, nonce);

      expect(directives['style-src']).toContain(`'nonce-${nonce}'`);
    });

    it('preserves existing directives', () => {
      const directives = addNonceToCSP(DEFAULT_CSP_DIRECTIVES, 'nonce');

      expect(directives['default-src']).toEqual(DEFAULT_CSP_DIRECTIVES['default-src']);
      expect(directives['object-src']).toEqual(DEFAULT_CSP_DIRECTIVES['object-src']);
    });
  });

  describe('generateNonce', () => {
    it('generates a string', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('string');
    });

    it('generates base64 encoded string', () => {
      const nonce = generateNonce();
      // Base64 characters
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('generates unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('cspMiddleware', () => {
    it('sets CSP header on response', () => {
      const request = createMockRequest();
      const response = createMockResponse();

      const result = cspMiddleware(request, response);

      expect(result.headers.get('Content-Security-Policy')).toBeTruthy();
    });

    it('sets additional security headers', () => {
      const request = createMockRequest();
      const response = createMockResponse();

      const result = cspMiddleware(request, response);

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(result.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(result.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(result.headers.get('Permissions-Policy')).toBeTruthy();
    });

    it('includes nonce when provided', () => {
      const request = createMockRequest();
      const response = createMockResponse();
      const nonce = 'test-nonce-789';

      const result = cspMiddleware(request, response, { nonce });
      const cspHeader = result.headers.get('Content-Security-Policy');

      expect(cspHeader).toContain(`nonce-${nonce}`);
    });

    it('uses development CSP in dev mode', () => {
      const request = createMockRequest();
      const response = createMockResponse();

      const result = cspMiddleware(request, response, { isDevelopment: true });
      const cspHeader = result.headers.get('Content-Security-Policy');

      expect(cspHeader).toContain("'unsafe-eval'");
    });
  });

  describe('getSecurityHeaders', () => {
    it('returns all security headers', () => {
      const headers = getSecurityHeaders();

      expect(headers['Content-Security-Policy']).toBeTruthy();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });

    it('supports nonce option', () => {
      const headers = getSecurityHeaders({ nonce: 'my-nonce' });

      expect(headers['Content-Security-Policy']).toContain('nonce-my-nonce');
    });
  });

  describe('isTrustedSource', () => {
    it('trusts localhost', () => {
      expect(isTrustedSource('http://localhost:3000/api')).toBe(true);
      expect(isTrustedSource('https://127.0.0.1:3000')).toBe(true);
    });

    it('trusts CDNs in whitelist', () => {
      expect(isTrustedSource('https://cdn.jsdelivr.net/npm/package')).toBe(true);
      expect(isTrustedSource('https://fonts.googleapis.com/css')).toBe(true);
    });

    it('rejects untrusted domains', () => {
      expect(isTrustedSource('https://evil.com/malware.js')).toBe(false);
      expect(isTrustedSource('https://attacker.io/script.js')).toBe(false);
    });

    it('handles invalid URLs gracefully', () => {
      expect(isTrustedSource('not-a-url')).toBe(false);
      expect(isTrustedSource('')).toBe(false);
    });
  });

  describe('logCSPViolation', () => {
    it('logs violation details', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const report = {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
        'source-file': 'inline',
        'line-number': 42,
      };

      logCSPViolation(report);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CSP Violation]',
        expect.objectContaining({
          violatedDirective: 'script-src',
          blockedUri: 'https://evil.com/script.js',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Security Scenarios', () => {
    it('prevents inline script injection', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      // Production CSP should not allow inline scripts
      expect(header).not.toContain("script-src 'unsafe-inline'");
    });

    it('prevents clickjacking with frame-ancestors', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      expect(header).toContain("frame-ancestors 'self'");
    });

    it('prevents data exfiltration by restricting connect-src', () => {
      const connectSrc = DEFAULT_CSP_DIRECTIVES['connect-src'];

      // Should include self but not wildcard
      expect(connectSrc).toContain("'self'");
      expect(connectSrc).not.toContain('*');
    });

    it('blocks object/embed exploitation', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      expect(header).toContain("object-src 'none'");
    });

    it('forces HTTPS upgrade', () => {
      const header = buildCSPHeader(DEFAULT_CSP_DIRECTIVES);

      expect(header).toContain('upgrade-insecure-requests');
    });
  });

  describe('TRUSTED_CDNS', () => {
    it('includes common CDNs', () => {
      expect(TRUSTED_CDNS).toContain('https://cdn.jsdelivr.net');
      expect(TRUSTED_CDNS).toContain('https://fonts.googleapis.com');
    });

    it('all entries are HTTPS', () => {
      TRUSTED_CDNS.forEach((cdn) => {
        expect(cdn.startsWith('https://')).toBe(true);
      });
    });
  });

  describe('TRUSTED_CONNECT_SOURCES', () => {
    it('includes self', () => {
      expect(TRUSTED_CONNECT_SOURCES).toContain("'self'");
    });

    it('includes required third-party APIs', () => {
      expect(TRUSTED_CONNECT_SOURCES.some((s) => s.includes('googleapis.com'))).toBe(true);
      expect(TRUSTED_CONNECT_SOURCES.some((s) => s.includes('stripe.com'))).toBe(true);
    });
  });
});
