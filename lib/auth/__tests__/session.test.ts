/**
 * Auth Session Utilities Tests
 *
 * Tests the session utilities including E2E test principal integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the headers function from next/headers
const mockHeaders = vi.fn();
vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

// Mock NextAuth
const mockNextAuth = vi.fn();
vi.mock('@/auth', () => ({
  auth: () => mockNextAuth(),
}));

// Mock e2e-middleware
vi.mock('@/lib/test-utils/e2e-middleware', () => ({
  isE2ETestModeAllowed: vi.fn(() => true),
}));

// Mock middleware constant
vi.mock('@/middleware', () => ({
  E2E_SESSION_HEADER: 'x-e2e-session',
}));

import { isE2ETestModeAllowed } from '@/lib/test-utils/e2e-middleware';
import {
  getAuthSession,
  getCurrentUserId,
  getCurrentUserEmail,
  isTestPrincipal,
  requireAuth,
} from '../session';

describe('Auth Session Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isE2ETestModeAllowed).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthSession', () => {
    it('returns test session when E2E mode allowed and header present', async () => {
      const testSession = {
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'google',
          image: null,
        },
        expires: '2026-12-31T00:00:00.000Z',
        isTestPrincipal: true,
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(testSession);
          }
          return null;
        }),
      });

      const session = await getAuthSession();

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('test-user-123');
      expect(session?.user.email).toBe('test@example.com');
      expect(session?.isTestPrincipal).toBe(true);
      // NextAuth should not be called when test session is present
      expect(mockNextAuth).not.toHaveBeenCalled();
    });

    it('falls back to NextAuth when no test session header', async () => {
      const nextAuthSession = {
        user: {
          id: 'real-user-456',
          email: 'real@example.com',
          name: 'Real User',
        },
        expires: '2026-12-31T00:00:00.000Z',
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(nextAuthSession);

      const session = await getAuthSession();

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe('real-user-456');
      expect(mockNextAuth).toHaveBeenCalled();
    });

    it('returns null when no session and no test principal', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(null);

      const session = await getAuthSession();

      expect(session).toBeNull();
    });

    it('uses NextAuth when E2E mode is not allowed', async () => {
      vi.mocked(isE2ETestModeAllowed).mockReturnValue(false);

      const testSession = {
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2026-12-31T00:00:00.000Z',
        isTestPrincipal: true,
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(testSession);
          }
          return null;
        }),
      });
      mockNextAuth.mockResolvedValue(null);

      const session = await getAuthSession();

      // Should ignore test session when E2E mode not allowed
      expect(session).toBeNull();
      expect(mockNextAuth).toHaveBeenCalled();
    });

    it('rejects test session without isTestPrincipal flag', async () => {
      const invalidSession = {
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2026-12-31T00:00:00.000Z',
        // Missing isTestPrincipal: true
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(invalidSession);
          }
          return null;
        }),
      });
      mockNextAuth.mockResolvedValue(null);

      const session = await getAuthSession();

      // Should fall back to NextAuth when test session is invalid
      expect(mockNextAuth).toHaveBeenCalled();
    });

    it('rejects test session with missing user fields', async () => {
      const invalidSession = {
        user: {
          // Missing id and email
          name: 'Test User',
        },
        expires: '2026-12-31T00:00:00.000Z',
        isTestPrincipal: true,
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(invalidSession);
          }
          return null;
        }),
      });
      mockNextAuth.mockResolvedValue(null);

      const session = await getAuthSession();

      expect(mockNextAuth).toHaveBeenCalled();
    });

    it('handles invalid JSON in test session header', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return 'not-valid-json';
          }
          return null;
        }),
      });
      mockNextAuth.mockResolvedValue(null);

      const session = await getAuthSession();

      // Should fall back to NextAuth on parse error
      expect(mockNextAuth).toHaveBeenCalled();
    });
  });

  describe('getCurrentUserId', () => {
    it('returns user ID from session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        expires: '2026-12-31',
      });

      const userId = await getCurrentUserId();

      expect(userId).toBe('user-123');
    });

    it('returns null when no session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(null);

      const userId = await getCurrentUserId();

      expect(userId).toBeNull();
    });
  });

  describe('getCurrentUserEmail', () => {
    it('returns user email from session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        expires: '2026-12-31',
      });

      const email = await getCurrentUserEmail();

      expect(email).toBe('user@example.com');
    });

    it('returns null when no session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(null);

      const email = await getCurrentUserEmail();

      expect(email).toBeNull();
    });
  });

  describe('isTestPrincipal', () => {
    it('returns true for test principal session', async () => {
      const testSession = {
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2026-12-31T00:00:00.000Z',
        isTestPrincipal: true,
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(testSession);
          }
          return null;
        }),
      });

      const result = await isTestPrincipal();

      expect(result).toBe(true);
    });

    it('returns false for regular session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        expires: '2026-12-31',
      });

      const result = await isTestPrincipal();

      expect(result).toBe(false);
    });

    it('returns false when no session', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(null);

      const result = await isTestPrincipal();

      expect(result).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('returns session when authenticated', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue({
        user: { id: 'user-123', email: 'user@example.com' },
        expires: '2026-12-31',
      });

      const session = await requireAuth();

      expect(session.user.id).toBe('user-123');
    });

    it('throws when not authenticated', async () => {
      mockHeaders.mockResolvedValue({
        get: vi.fn(() => null),
      });
      mockNextAuth.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });

    it('works with test principal session', async () => {
      const testSession = {
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2026-12-31T00:00:00.000Z',
        isTestPrincipal: true,
      };

      mockHeaders.mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'x-e2e-session') {
            return JSON.stringify(testSession);
          }
          return null;
        }),
      });

      const session = await requireAuth();

      expect(session.user.id).toBe('test-user-123');
      expect(session.isTestPrincipal).toBe(true);
    });
  });
});
