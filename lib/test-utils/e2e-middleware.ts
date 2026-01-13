/**
 * E2E Test Principal Middleware
 *
 * SECURITY: This middleware enables test principal injection for E2E tests.
 * It has multiple layers of defense to prevent misuse in production:
 *
 * 1. Environment Check: Only enabled when NODE_ENV !== 'production'
 * 2. Secret Verification: Requires E2E_TEST_SECRET to match
 * 3. Principal Tagging: All test principals are tagged with `isTestPrincipal: true`
 * 4. Audit Logging: All test principal usage is logged
 * 5. Cedar Policy: Production Cedar policies explicitly DENY test principals
 *
 * Usage (in Playwright tests):
 *   test.use({
 *     extraHTTPHeaders: {
 *       'X-E2E-Test-Principal': JSON.stringify(testUser),
 *       'X-E2E-Test-Secret': process.env.E2E_TEST_SECRET,
 *     },
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';

// Test principal structure
interface TestPrincipal {
  id: string;
  email: string;
  name: string;
  provider?: string;
  memberships?: Array<{
    orgId: string;
    orgName: string;
    role: string;
  }>;
}

// Extended session with test flag
export interface TestAwareSession {
  user: {
    id: string;
    email: string;
    name: string;
    provider?: string;
    image?: string | null;
  };
  expires: string;
  isTestPrincipal: boolean; // Always present, always checked
}

/**
 * Check if E2E test mode is allowed in the current environment.
 *
 * SECURITY: This is the first line of defense.
 * E2E test mode is ONLY allowed when:
 * - NODE_ENV is NOT 'production'
 * - Or explicitly enabled via ALLOW_E2E_TEST_MODE=true (for staging tests)
 */
export function isE2ETestModeAllowed(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const explicitlyAllowed = process.env.ALLOW_E2E_TEST_MODE === 'true';

  // Never allow in production unless explicitly overridden (e.g., for pre-prod tests)
  if (nodeEnv === 'production' && !explicitlyAllowed) {
    return false;
  }

  return true;
}

/**
 * Verify the E2E test secret matches.
 *
 * SECURITY: This is the second line of defense.
 * Even if someone tries to inject headers, they need the secret.
 */
export function verifyE2ESecret(providedSecret: string | null): boolean {
  const expectedSecret = process.env.E2E_TEST_SECRET;

  // If no secret is configured, deny all test principal requests
  if (!expectedSecret) {
    console.warn('[E2E Security] No E2E_TEST_SECRET configured, denying test principal');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (!providedSecret || providedSecret.length !== expectedSecret.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    result |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Parse and validate a test principal from headers.
 *
 * SECURITY: Validates the principal structure to prevent injection attacks.
 */
export function parseTestPrincipal(
  principalHeader: string | null
): TestPrincipal | null {
  if (!principalHeader) {
    return null;
  }

  try {
    const parsed = JSON.parse(principalHeader);

    // Validate required fields
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string'
    ) {
      console.warn('[E2E Security] Invalid test principal structure');
      return null;
    }

    // Validate email format (basic check)
    if (!parsed.email.includes('@')) {
      console.warn('[E2E Security] Invalid email in test principal');
      return null;
    }

    // Validate memberships if present
    if (parsed.memberships) {
      if (!Array.isArray(parsed.memberships)) {
        console.warn('[E2E Security] Invalid memberships in test principal');
        return null;
      }

      for (const m of parsed.memberships) {
        if (typeof m.orgId !== 'string' || typeof m.role !== 'string') {
          console.warn('[E2E Security] Invalid membership structure');
          return null;
        }
      }
    }

    return parsed as TestPrincipal;
  } catch {
    console.warn('[E2E Security] Failed to parse test principal JSON');
    return null;
  }
}

/**
 * Create a test-aware session from a test principal.
 *
 * SECURITY: Always marks the session with isTestPrincipal: true
 * This flag is checked by Cedar policies and application code.
 */
export function createTestSession(principal: TestPrincipal): TestAwareSession {
  return {
    user: {
      id: principal.id,
      email: principal.email,
      name: principal.name,
      provider: principal.provider || 'test',
      image: null,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    isTestPrincipal: true, // ALWAYS TRUE for test sessions
  };
}

/**
 * Log test principal usage for audit purposes.
 *
 * SECURITY: Creates audit trail of all test principal usage.
 */
export function auditTestPrincipalUsage(
  principal: TestPrincipal,
  requestPath: string,
  allowed: boolean
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'E2E_TEST_PRINCIPAL',
    allowed,
    principalId: principal.id,
    principalEmail: principal.email,
    requestPath,
    environment: process.env.NODE_ENV,
  };

  // In production-like environments, this would go to Cloud Logging
  // In dev, we log to console with a clear marker
  if (allowed) {
    console.log('[E2E Audit]', JSON.stringify(logEntry));
  } else {
    console.warn('[E2E Audit - BLOCKED]', JSON.stringify(logEntry));
  }
}

/**
 * Extract test session from request if valid.
 *
 * This is the main entry point for test principal injection.
 * Returns null if:
 * - E2E mode is not allowed
 * - Secret doesn't match
 * - Principal is invalid
 */
export function extractTestSession(
  request: NextRequest
): TestAwareSession | null {
  const principalHeader = request.headers.get('X-E2E-Test-Principal');
  const secretHeader = request.headers.get('X-E2E-Test-Secret');

  // No test headers present - not a test request
  if (!principalHeader) {
    return null;
  }

  // SECURITY CHECK 1: Environment
  if (!isE2ETestModeAllowed()) {
    console.error(
      '[E2E Security] BLOCKED: Test principal injection attempted in production'
    );
    auditTestPrincipalUsage(
      { id: 'unknown', email: 'unknown', name: 'unknown' },
      request.nextUrl.pathname,
      false
    );
    return null;
  }

  // SECURITY CHECK 2: Secret
  if (!verifyE2ESecret(secretHeader)) {
    console.error('[E2E Security] BLOCKED: Invalid or missing E2E test secret');
    auditTestPrincipalUsage(
      { id: 'unknown', email: 'unknown', name: 'unknown' },
      request.nextUrl.pathname,
      false
    );
    return null;
  }

  // SECURITY CHECK 3: Parse and validate principal
  const principal = parseTestPrincipal(principalHeader);
  if (!principal) {
    console.error('[E2E Security] BLOCKED: Invalid test principal format');
    return null;
  }

  // Audit the successful test principal usage
  auditTestPrincipalUsage(principal, request.nextUrl.pathname, true);

  // Create session with test flag
  return createTestSession(principal);
}

/**
 * Middleware to deny requests with isTestPrincipal in production.
 *
 * SECURITY: This is an additional layer that runs in the application.
 * Even if test principal injection somehow bypasses earlier checks,
 * this middleware will block the request.
 */
export function createProductionGuardMiddleware() {
  return (request: NextRequest) => {
    // In production, actively reject any requests with test principal headers
    if (process.env.NODE_ENV === 'production') {
      const hasTestHeader = request.headers.has('X-E2E-Test-Principal');

      if (hasTestHeader) {
        console.error(
          '[SECURITY ALERT] Test principal header detected in production!'
        );

        // Return 403 with security message
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Test mode not available',
          },
          { status: 403 }
        );
      }
    }

    return null; // Continue to next middleware
  };
}

/**
 * Check if a session is a test session.
 *
 * Use this in application code to add additional restrictions
 * for test sessions if needed.
 */
export function isTestSession(
  session: { isTestPrincipal?: boolean } | null
): boolean {
  return session?.isTestPrincipal === true;
}
