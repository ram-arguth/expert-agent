/**
 * Authentication Utilities with E2E Test Support
 *
 * This module provides authentication functions that work with both
 * NextAuth sessions and E2E test principal injection.
 *
 * SECURITY: Test principal injection is only allowed when:
 * 1. NODE_ENV !== 'production' OR ALLOW_E2E_TEST_MODE=true
 * 2. E2E_TEST_SECRET header matches configured secret
 * 3. Principal data is validated (structure, email format)
 *
 * @see middleware.ts for how test sessions are injected
 * @see lib/test-utils/e2e-middleware.ts for security documentation
 */

import { headers } from 'next/headers';
import { nextAuthRaw, type Session } from '@/auth';
import { E2E_SESSION_HEADER } from '@/middleware';
import { isE2ETestModeAllowed, type TestAwareSession } from '@/lib/test-utils/e2e-middleware';

/**
 * Extended session type that includes test principal flag
 */
export interface AuthSession extends Session {
  isTestPrincipal?: boolean;
}

/**
 * Get the current session, supporting both NextAuth and E2E test principals.
 *
 * This function first checks for an E2E test session injected by middleware,
 * then falls back to the normal NextAuth session.
 *
 * @returns The current session, or null if not authenticated
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  // Only check for test session if E2E mode is allowed
  if (isE2ETestModeAllowed()) {
    const testSession = await getTestSession();
    if (testSession) {
      // Convert TestAwareSession to AuthSession format
      return {
        user: {
          id: testSession.user.id,
          email: testSession.user.email,
          name: testSession.user.name,
          image: testSession.user.image,
          provider: testSession.user.provider,
        },
        expires: testSession.expires,
        isTestPrincipal: true,
      } as AuthSession;
    }
  }

  // Fall back to NextAuth session
  const session = await nextAuthRaw();
  return session;
}

/**
 * Extract test session from request headers (set by middleware)
 *
 * @returns The test session if present and valid, null otherwise
 */
async function getTestSession(): Promise<TestAwareSession | null> {
  try {
    const headersList = await headers();
    const testSessionHeader = headersList.get(E2E_SESSION_HEADER);

    if (!testSessionHeader) {
      return null;
    }

    const testSession = JSON.parse(testSessionHeader) as TestAwareSession;

    // Validate the test session has required fields
    if (!testSession.user?.id || !testSession.user?.email) {
      console.error('[Auth] Invalid test session: missing required fields');
      return null;
    }

    // Verify this is actually a test principal
    if (!testSession.isTestPrincipal) {
      console.error('[Auth] Test session missing isTestPrincipal flag');
      return null;
    }

    return testSession;
  } catch (error) {
    console.error('[Auth] Failed to parse test session:', error);
    return null;
  }
}

/**
 * Get the current user ID from the session.
 *
 * @returns The user ID, or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user?.id ?? null;
}

/**
 * Get the current user email from the session.
 *
 * @returns The user email, or null if not authenticated
 */
export async function getCurrentUserEmail(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user?.email ?? null;
}

/**
 * Check if the current session is from a test principal.
 *
 * @returns True if this is a test principal session
 */
export async function isTestPrincipal(): Promise<boolean> {
  const session = await getAuthSession();
  return !!(session as AuthSession)?.isTestPrincipal;
}

/**
 * Require authentication - throws if not authenticated.
 *
 * @returns The authenticated session
 * @throws Error if not authenticated
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}
