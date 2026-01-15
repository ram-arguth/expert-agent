/**
 * Next.js Middleware
 *
 * This middleware runs on all requests before they reach route handlers.
 *
 * Features:
 * 1. E2E Test Principal Injection (non-production only)
 * 2. CSP Header Injection
 * 3. Request tracing context propagation
 *
 * SECURITY: Test principal injection is protected by multiple layers:
 * - Environment check (NODE_ENV !== 'production')
 * - Secret verification (E2E_TEST_SECRET header)
 * - Principal validation (structure, email format)
 * - Audit logging (all test principal usage logged)
 *
 * @see lib/test-utils/e2e-middleware.ts for full security documentation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractTestSession,
  isE2ETestModeAllowed,
  createProductionGuardMiddleware,
} from '@/lib/test-utils/e2e-middleware';
import { generateTraceContext } from '@/lib/observability/logger';

// Test session storage key for middleware-to-handler communication
export const E2E_SESSION_HEADER = 'x-e2e-session';

export async function middleware(request: NextRequest) {
  // Clone the response headers
  const response = NextResponse.next();

  // SECURITY: Production guard - reject any test headers in production
  const guardResponse = createProductionGuardMiddleware()(request);
  if (guardResponse) {
    return guardResponse;
  }

  // E2E Test Principal Injection (non-production only)
  if (isE2ETestModeAllowed()) {
    const testSession = extractTestSession(request);
    if (testSession) {
      // Store test session in a header for downstream handlers to use
      // This is safe because:
      // 1. The header is set by our middleware, not the client
      // 2. We've already validated the test secret
      // 3. The session is tagged with isTestPrincipal: true
      response.headers.set(E2E_SESSION_HEADER, JSON.stringify(testSession));
    }
  }

  // Add trace context if not present
  const existingTraceParent = request.headers.get('traceparent');
  if (!existingTraceParent) {
    const trace = generateTraceContext();
    response.headers.set('x-trace-id', trace.traceId);
    response.headers.set('x-span-id', trace.spanId);
  }

  // CSP Headers (basic - see lib/middleware/csp-middleware.ts for full implementation)
  // Note: Full CSP is applied in API routes and pages, this is a fallback
  if (!response.headers.has('Content-Security-Policy')) {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js dev
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.googleapis.com",
        "frame-ancestors 'none'",
        "form-action 'self'",
      ].join('; ')
    );
  }

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

// Configure which routes the middleware applies to
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
