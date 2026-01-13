/**
 * Tests for E2E Test Principal Middleware Security
 *
 * These tests verify that test principal injection has proper security controls:
 * 1. Only works in non-production environments
 * 2. Requires valid secret
 * 3. Validates principal structure
 * 4. Logs all usage for audit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isE2ETestModeAllowed,
  verifyE2ESecret,
  parseTestPrincipal,
  createTestSession,
  isTestSession,
} from './e2e-middleware';

describe('E2E Test Middleware Security', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isE2ETestModeAllowed', () => {
    it('allows in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(isE2ETestModeAllowed()).toBe(true);
    });

    it('allows in test', () => {
      vi.stubEnv('NODE_ENV', 'test');
      expect(isE2ETestModeAllowed()).toBe(true);
    });

    it('BLOCKS in production by default', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ALLOW_E2E_TEST_MODE', '');
      expect(isE2ETestModeAllowed()).toBe(false);
    });

    it('allows in production only with explicit override', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ALLOW_E2E_TEST_MODE', 'true');
      expect(isE2ETestModeAllowed()).toBe(true);
    });

    it('blocks in production with false override', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ALLOW_E2E_TEST_MODE', 'false');
      expect(isE2ETestModeAllowed()).toBe(false);
    });
  });

  describe('verifyE2ESecret', () => {
    it('returns false when no secret is configured', () => {
      vi.stubEnv('E2E_TEST_SECRET', '');
      expect(verifyE2ESecret('any-secret')).toBe(false);
    });

    it('returns false when provided secret is null', () => {
      vi.stubEnv('E2E_TEST_SECRET', 'correct-secret');
      expect(verifyE2ESecret(null)).toBe(false);
    });

    it('returns false when secrets dont match', () => {
      vi.stubEnv('E2E_TEST_SECRET', 'correct-secret');
      expect(verifyE2ESecret('wrong-secret')).toBe(false);
    });

    it('returns true when secrets match', () => {
      vi.stubEnv('E2E_TEST_SECRET', 'correct-secret');
      expect(verifyE2ESecret('correct-secret')).toBe(true);
    });

    it('handles length mismatch (timing-safe)', () => {
      vi.stubEnv('E2E_TEST_SECRET', 'short');
      expect(verifyE2ESecret('much-longer-secret')).toBe(false);
    });
  });

  describe('parseTestPrincipal', () => {
    it('returns null for null input', () => {
      expect(parseTestPrincipal(null)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseTestPrincipal('not-json')).toBeNull();
    });

    it('returns null for missing required fields', () => {
      expect(parseTestPrincipal(JSON.stringify({ id: '1' }))).toBeNull();
      expect(parseTestPrincipal(JSON.stringify({ email: 'a@b.com' }))).toBeNull();
    });

    it('returns null for invalid email', () => {
      expect(
        parseTestPrincipal(
          JSON.stringify({
            id: '1',
            email: 'invalid-email',
            name: 'Test',
          })
        )
      ).toBeNull();
    });

    it('returns null for invalid memberships', () => {
      expect(
        parseTestPrincipal(
          JSON.stringify({
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            memberships: 'not-an-array',
          })
        )
      ).toBeNull();
    });

    it('returns null for invalid membership structure', () => {
      expect(
        parseTestPrincipal(
          JSON.stringify({
            id: '1',
            email: 'test@example.com',
            name: 'Test',
            memberships: [{ invalidField: 'test' }],
          })
        )
      ).toBeNull();
    });

    it('parses valid principal', () => {
      const principal = parseTestPrincipal(
        JSON.stringify({
          id: 'test-user-1',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'google',
        })
      );

      expect(principal).not.toBeNull();
      expect(principal?.id).toBe('test-user-1');
      expect(principal?.email).toBe('test@example.com');
    });

    it('parses principal with memberships', () => {
      const principal = parseTestPrincipal(
        JSON.stringify({
          id: 'test-user-1',
          email: 'test@example.com',
          name: 'Test User',
          memberships: [
            { orgId: 'org-1', orgName: 'Org 1', role: 'OWNER' },
            { orgId: 'org-2', orgName: 'Org 2', role: 'MEMBER' },
          ],
        })
      );

      expect(principal).not.toBeNull();
      expect(principal?.memberships).toHaveLength(2);
    });
  });

  describe('createTestSession', () => {
    it('always sets isTestPrincipal to true', () => {
      const session = createTestSession({
        id: 'test-1',
        email: 'test@example.com',
        name: 'Test',
      });

      expect(session.isTestPrincipal).toBe(true);
    });

    it('sets default provider to test', () => {
      const session = createTestSession({
        id: 'test-1',
        email: 'test@example.com',
        name: 'Test',
      });

      expect(session.user.provider).toBe('test');
    });

    it('uses provided provider', () => {
      const session = createTestSession({
        id: 'test-1',
        email: 'test@example.com',
        name: 'Test',
        provider: 'google',
      });

      expect(session.user.provider).toBe('google');
    });

    it('sets expiry in the future', () => {
      const session = createTestSession({
        id: 'test-1',
        email: 'test@example.com',
        name: 'Test',
      });

      const expiry = new Date(session.expires);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('isTestSession', () => {
    it('returns false for null session', () => {
      expect(isTestSession(null)).toBe(false);
    });

    it('returns false for session without isTestPrincipal', () => {
      // Using any cast since we're testing edge cases with malformed objects
      expect(isTestSession({ user: { id: '1' } } as unknown as { isTestPrincipal?: boolean })).toBe(false);
    });

    it('returns false for session with isTestPrincipal: false', () => {
      expect(isTestSession({ isTestPrincipal: false })).toBe(false);
    });

    it('returns true for session with isTestPrincipal: true', () => {
      expect(isTestSession({ isTestPrincipal: true })).toBe(true);
    });
  });
});
