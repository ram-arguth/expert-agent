/**
 * Circuit Breaker Tests
 *
 * Tests for cost control circuit breaker including:
 * - Spend tracking
 * - Threshold detection
 * - Account suspension
 * - Admin overrides
 *
 * @see docs/IMPEMENTATION.md - Phase 0.7 Test Requirements
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
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
} from '../circuit-breaker';

describe('Circuit Breaker', () => {
  beforeEach(() => {
    resetCircuitBreaker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordSpend', () => {
    it('allows spend under threshold', () => {
      const result = recordSpend('user-123', 10);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('tracks current spend', () => {
      recordSpend('user-123', 10);
      recordSpend('user-123', 20);

      expect(getCurrentSpend('user-123')).toBe(30);
    });

    it('detects spend over threshold', () => {
      const thresholds = [
        { amount: 50, windowMs: 60000, action: 'alert' as const },
      ];

      recordSpend('user-alert', 60, undefined, thresholds);

      const alerts = getAlerts('user-alert');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].threshold).toBe(50);
    });

    it('triggers alert when threshold exceeded', () => {
      const alertHandler = vi.fn();
      onAlert(alertHandler);

      const thresholds = [
        { amount: 25, windowMs: 60000, action: 'alert' as const },
      ];

      recordSpend('user-trigger', 30, undefined, thresholds);

      expect(alertHandler).toHaveBeenCalled();
      expect(alertHandler.mock.calls[0][1].amount).toBe(25);
    });

    it('suspends account correctly when suspend threshold hit', () => {
      const thresholds = [
        { amount: 100, windowMs: 60000, action: 'suspend' as const },
      ];

      const result = recordSpend('user-suspend', 150, undefined, thresholds);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceeded threshold');
      expect(isSuspended('user-suspend')).toBe(true);
    });

    it('blocks subsequent requests when suspended', () => {
      const thresholds = [
        { amount: 50, windowMs: 60000, action: 'suspend' as const },
      ];

      // First request triggers suspension
      recordSpend('user-blocked', 75, undefined, thresholds);

      // Subsequent request should be blocked
      const result = recordSpend('user-blocked', 5, undefined, thresholds);

      expect(result.allowed).toBe(false);
    });

    it('resets spend after window expires', () => {
      const windowMs = 60000;
      const thresholds = [
        { amount: 100, windowMs, action: 'alert' as const },
      ];

      // Spend under threshold
      recordSpend('user-reset', 80, undefined, thresholds);
      expect(getCurrentSpend('user-reset')).toBe(80);

      // Advance past window
      vi.advanceTimersByTime(windowMs + 1);

      // New spend should reset
      recordSpend('user-reset', 30, undefined, thresholds);
      expect(getCurrentSpend('user-reset')).toBe(30);
    });
  });

  describe('isSuspended', () => {
    it('returns false for new user', () => {
      expect(isSuspended('new-user')).toBe(false);
    });

    it('returns true for suspended user', () => {
      suspendAccount('suspended-user', 'Test reason');
      expect(isSuspended('suspended-user')).toBe(true);
    });

    it('returns false when admin override is active', () => {
      suspendAccount('override-user', 'Test reason');
      setAdminOverride('override-user', 'admin-1', 'Testing');

      expect(isSuspended('override-user')).toBe(false);
    });
  });

  describe('Admin Override', () => {
    it('admin override works', () => {
      const thresholds = [
        { amount: 50, windowMs: 60000, action: 'suspend' as const },
      ];

      // Suspend user
      recordSpend('admin-test', 75, undefined, thresholds);
      expect(isSuspended('admin-test')).toBe(true);

      // Admin override
      setAdminOverride('admin-test', 'admin-1', 'Legitimate usage');

      // User should be allowed now
      expect(isSuspended('admin-test')).toBe(false);
      const result = recordSpend('admin-test', 10, undefined, thresholds);
      expect(result.allowed).toBe(true);
    });

    it('creates override record', () => {
      setAdminOverride('override-record', 'admin-2', 'Testing');

      const override = getAdminOverride('override-record');
      expect(override).toBeDefined();
      expect(override?.adminId).toBe('admin-2');
      expect(override?.reason).toBe('Testing');
    });

    it('override expires correctly', () => {
      setAdminOverride('expire-user', 'admin-3', 'Temp override', 5000);

      expect(isSuspended('expire-user')).toBe(false);

      // Advance past expiration
      vi.advanceTimersByTime(6000);

      // Re-suspend
      suspendAccount('expire-user', 'Re-suspended');
      expect(isSuspended('expire-user')).toBe(true);
    });

    it('can remove override', () => {
      setAdminOverride('remove-override', 'admin-4', 'Temp');
      expect(getAdminOverride('remove-override')).toBeDefined();

      removeAdminOverride('remove-override');
      expect(getAdminOverride('remove-override')).toBeUndefined();
    });
  });

  describe('Manual Suspension', () => {
    it('can manually suspend account', () => {
      suspendAccount('manual-suspend', 'Policy violation');

      expect(isSuspended('manual-suspend')).toBe(true);
      const state = getState('manual-suspend');
      expect(state?.suspendedReason).toBe('Policy violation');
    });

    it('can manually unsuspend account', () => {
      suspendAccount('unsuspend-test', 'Test');
      expect(isSuspended('unsuspend-test')).toBe(true);

      unsuspendAccount('unsuspend-test');
      expect(isSuspended('unsuspend-test')).toBe(false);
    });
  });

  describe('Org-level tracking', () => {
    it('tracks org spend separately', () => {
      recordSpend('user-1', 50, 'org-abc');
      recordSpend('user-2', 30, 'org-abc');

      expect(getCurrentSpend('user-1', 'org-abc')).toBe(80);
    });

    it('suspends org when threshold exceeded', () => {
      const thresholds = [
        { amount: 100, windowMs: 60000, action: 'suspend' as const },
      ];

      recordSpend('user-1', 60, 'org-suspend', thresholds);
      recordSpend('user-2', 50, 'org-suspend', thresholds);

      expect(isSuspended('user-1', 'org-suspend')).toBe(true);
    });
  });

  describe('estimateCostFromTokens', () => {
    it('calculates cost correctly', () => {
      const cost = estimateCostFromTokens(1000, 500);

      // 1000 input tokens at 0.00125 per 1k = 0.00125
      // 500 output tokens at 0.005 per 1k = 0.0025
      // Total = 0.00375
      expect(cost).toBeCloseTo(0.00375, 5);
    });

    it('accepts custom pricing', () => {
      const cost = estimateCostFromTokens(1000, 1000, {
        inputPer1k: 0.01,
        outputPer1k: 0.03,
      });

      // 1k input at 0.01 = 0.01
      // 1k output at 0.03 = 0.03
      // Total = 0.04
      expect(cost).toBeCloseTo(0.04, 5);
    });

    it('handles zero tokens', () => {
      expect(estimateCostFromTokens(0, 0)).toBe(0);
    });
  });

  describe('DEFAULT_THRESHOLDS', () => {
    it('has expected thresholds', () => {
      expect(DEFAULT_THRESHOLDS.userHourlyAlert).toBeDefined();
      expect(DEFAULT_THRESHOLDS.userHourlySuspend).toBeDefined();
      expect(DEFAULT_THRESHOLDS.userDailyCritical).toBeDefined();
      expect(DEFAULT_THRESHOLDS.orgDailyBudget).toBeDefined();
    });

    it('hourly suspend is higher than hourly alert', () => {
      expect(DEFAULT_THRESHOLDS.userHourlySuspend.amount).toBeGreaterThan(
        DEFAULT_THRESHOLDS.userHourlyAlert.amount
      );
    });
  });

  describe('Alert Records', () => {
    it('stores alert history', () => {
      const thresholds = [
        { amount: 10, windowMs: 60000, action: 'alert' as const },
        { amount: 20, windowMs: 60000, action: 'alert' as const },
      ];

      recordSpend('alert-history', 25, undefined, thresholds);

      const alerts = getAlerts('alert-history');
      expect(alerts.length).toBe(2);
    });

    it('alert record includes spend details', () => {
      const thresholds = [
        { amount: 15, windowMs: 60000, action: 'alert' as const },
      ];

      recordSpend('alert-details', 20, undefined, thresholds);

      const alerts = getAlerts('alert-details');
      expect(alerts[0].threshold).toBe(15);
      expect(alerts[0].actualSpend).toBe(20);
      expect(alerts[0].action).toBe('alert');
    });
  });
});
