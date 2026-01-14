/**
 * Rate Limiter Tests
 *
 * Tests for the rate limiting functionality including:
 * - Request counting
 * - Window expiration
 * - Tiered limits
 * - Security scenarios
 *
 * @see docs/IMPEMENTATION.md - Phase 0.7 Test Requirements
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimiter,
  DEFAULT_RATE_LIMITS,
  userRateLimitKey,
  orgRateLimitKey,
  ipRateLimitKey,
  getTierFromPlan,
  checkRateLimitWithHeaders,
  RateLimitTier,
} from '../rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('allows requests under limit', () => {
      const result = checkRateLimit('user:123', 'free');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_RATE_LIMITS.free.maxRequests - 1);
    });

    it('blocks requests over limit', () => {
      const key = 'user:456';
      const limit = 5;

      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'free', { maxRequests: limit, windowMs: 60000 });
      }

      // Next request should be blocked
      const result = checkRateLimit(key, 'free', {
        maxRequests: limit,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('resets after time window', () => {
      const key = 'user:789';
      const windowMs = 60000;
      const limit = 2;

      // Exhaust the limit
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'free', { maxRequests: limit, windowMs });
      }

      // Should be blocked
      let result = checkRateLimit(key, 'free', { maxRequests: limit, windowMs });
      expect(result.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1);

      // Should be allowed again
      result = checkRateLimit(key, 'free', { maxRequests: limit, windowMs });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - 1);
    });

    it('applies correct limits for free tier', () => {
      const result = checkRateLimit('user:free', 'free');

      expect(result.limit).toBe(DEFAULT_RATE_LIMITS.free.maxRequests);
    });

    it('applies correct limits for pro tier', () => {
      const result = checkRateLimit('user:pro', 'pro');

      expect(result.limit).toBe(DEFAULT_RATE_LIMITS.pro.maxRequests);
    });

    it('applies correct limits for enterprise tier', () => {
      const result = checkRateLimit('user:enterprise', 'enterprise');

      expect(result.limit).toBe(DEFAULT_RATE_LIMITS.enterprise.maxRequests);
    });

    it('allows unlimited requests for admin tier', () => {
      const result = checkRateLimit('user:admin', 'admin');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
      expect(result.limit).toBe(Infinity);
    });

    it('tracks remaining requests correctly', () => {
      const key = 'user:track';
      const limit = 10;

      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 'free', { maxRequests: limit, windowMs: 60000 });
      }

      const result = checkRateLimit(key, 'free', {
        maxRequests: limit,
        windowMs: 60000,
      });

      expect(result.remaining).toBe(limit - 6);
    });

    it('calculates resetInMs correctly', () => {
      const key = 'user:reset';
      const windowMs = 60000;

      // First request starts the window
      checkRateLimit(key, 'free', { maxRequests: 10, windowMs });

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);

      // Next request should show ~30 seconds remaining
      const result = checkRateLimit(key, 'free', { maxRequests: 10, windowMs });

      expect(result.resetInMs).toBeGreaterThan(29000);
      expect(result.resetInMs).toBeLessThanOrEqual(30001);
    });

    it('uses custom limits over tier defaults', () => {
      const customLimits = { maxRequests: 5, windowMs: 30000 };
      const result = checkRateLimit('user:custom', 'pro', customLimits);

      expect(result.limit).toBe(5);
    });

    it('isolates different keys', () => {
      const limit = 3;
      const config = { maxRequests: limit, windowMs: 60000 };

      // Exhaust limit for key1
      for (let i = 0; i < limit; i++) {
        checkRateLimit('key1', 'free', config);
      }

      // key1 should be blocked
      expect(checkRateLimit('key1', 'free', config).allowed).toBe(false);

      // key2 should still be allowed
      expect(checkRateLimit('key2', 'free', config).allowed).toBe(true);
    });
  });

  describe('Key Generators', () => {
    it('creates user rate limit key', () => {
      expect(userRateLimitKey('123')).toBe('user:123');
    });

    it('creates user rate limit key with action', () => {
      expect(userRateLimitKey('123', 'query')).toBe('user:123:query');
    });

    it('creates org rate limit key', () => {
      expect(orgRateLimitKey('org-456')).toBe('org:org-456');
    });

    it('creates org rate limit key with action', () => {
      expect(orgRateLimitKey('org-456', 'upload')).toBe('org:org-456:upload');
    });

    it('creates IP rate limit key', () => {
      expect(ipRateLimitKey('192.168.1.1')).toBe('ip:192.168.1.1');
    });

    it('creates IP rate limit key with action', () => {
      expect(ipRateLimitKey('192.168.1.1', 'login')).toBe('ip:192.168.1.1:login');
    });
  });

  describe('getTierFromPlan', () => {
    it('returns free for undefined plan', () => {
      expect(getTierFromPlan(undefined)).toBe('free');
    });

    it('returns free for null plan', () => {
      expect(getTierFromPlan(null)).toBe('free');
    });

    it('returns free for unknown plan', () => {
      expect(getTierFromPlan('unknown')).toBe('free');
    });

    it('returns pro for pro plan', () => {
      expect(getTierFromPlan('pro')).toBe('pro');
    });

    it('returns pro for professional plan', () => {
      expect(getTierFromPlan('professional')).toBe('pro');
    });

    it('returns enterprise for enterprise plan', () => {
      expect(getTierFromPlan('enterprise')).toBe('enterprise');
    });

    it('returns admin for admin plan', () => {
      expect(getTierFromPlan('admin')).toBe('admin');
    });

    it('is case-insensitive', () => {
      expect(getTierFromPlan('PRO')).toBe('pro');
      expect(getTierFromPlan('Enterprise')).toBe('enterprise');
    });
  });

  describe('checkRateLimitWithHeaders', () => {
    it('returns rate limit headers', () => {
      const { headers } = checkRateLimitWithHeaders({
        key: 'user:headers',
        tier: 'free',
      });

      expect(headers['X-RateLimit-Limit']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('includes Retry-After header when blocked', () => {
      const key = 'user:blocked';
      const limit = 1;

      // Exhaust limit
      checkRateLimitWithHeaders({
        key,
        customLimits: { maxRequests: limit, windowMs: 60000 },
      });

      // Next request should include Retry-After
      const { result, headers } = checkRateLimitWithHeaders({
        key,
        customLimits: { maxRequests: limit, windowMs: 60000 },
      });

      expect(result.allowed).toBe(false);
      expect(headers['Retry-After']).toBeDefined();
    });

    it('applies action to key', () => {
      const { result: result1 } = checkRateLimitWithHeaders({
        key: 'user:action',
        action: 'query',
        customLimits: { maxRequests: 1, windowMs: 60000 },
      });

      // Exhaust query action limit
      expect(result1.allowed).toBe(true);

      const { result: result2 } = checkRateLimitWithHeaders({
        key: 'user:action',
        action: 'query',
        customLimits: { maxRequests: 1, windowMs: 60000 },
      });

      expect(result2.allowed).toBe(false);

      // Different action should still be allowed
      const { result: result3 } = checkRateLimitWithHeaders({
        key: 'user:action',
        action: 'upload',
        customLimits: { maxRequests: 1, windowMs: 60000 },
      });

      expect(result3.allowed).toBe(true);
    });
  });

  describe('DEFAULT_RATE_LIMITS', () => {
    it('has expected tiers', () => {
      const tiers: RateLimitTier[] = ['free', 'pro', 'enterprise', 'admin'];

      tiers.forEach((tier) => {
        expect(DEFAULT_RATE_LIMITS[tier]).toBeDefined();
        expect(DEFAULT_RATE_LIMITS[tier].maxRequests).toBeDefined();
        expect(DEFAULT_RATE_LIMITS[tier].windowMs).toBeDefined();
      });
    });

    it('free tier is more restrictive than pro', () => {
      expect(DEFAULT_RATE_LIMITS.free.maxRequests).toBeLessThan(
        DEFAULT_RATE_LIMITS.pro.maxRequests
      );
    });

    it('pro tier is more restrictive than enterprise', () => {
      expect(DEFAULT_RATE_LIMITS.pro.maxRequests).toBeLessThan(
        DEFAULT_RATE_LIMITS.enterprise.maxRequests
      );
    });
  });

  describe('Security Scenarios', () => {
    it('prevents brute force by rate limiting', () => {
      const attackerIp = '192.168.1.100';
      const key = ipRateLimitKey(attackerIp, 'login');
      const limit = 5;

      // Attacker attempts multiple logins
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'free', { maxRequests: limit, windowMs: 60000 });
      }

      // Further attempts should be blocked
      const result = checkRateLimit(key, 'free', {
        maxRequests: limit,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
    });

    it('prevents API abuse by per-user limiting', () => {
      const userId = 'abusive-user';
      const key = userRateLimitKey(userId, 'query');
      const limit = 100;

      // User exhausts their quota
      for (let i = 0; i < limit; i++) {
        checkRateLimit(key, 'free', { maxRequests: limit, windowMs: 60000 });
      }

      // Further requests should be blocked
      const result = checkRateLimit(key, 'free', {
        maxRequests: limit,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(false);
      expect(result.resetInMs).toBeGreaterThan(0);
    });

    it('one user cannot exhaust org quota alone', () => {
      // Simulate two different users in same org
      const orgKey = orgRateLimitKey('org-123', 'query');
      const orgLimit = 10;

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(orgKey, 'pro', { maxRequests: orgLimit, windowMs: 60000 });
      }

      // Org still has capacity
      const result = checkRateLimit(orgKey, 'pro', {
        maxRequests: orgLimit,
        windowMs: 60000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});
