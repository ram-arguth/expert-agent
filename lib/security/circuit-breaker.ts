/**
 * Circuit Breaker for Cost Control
 *
 * Implements anomalous usage detection to prevent runaway costs.
 * Detects excessive spending and auto-suspends accounts when thresholds are exceeded.
 *
 * @see docs/IMPEMENTATION.md - Phase 0.8 Security & Compliance
 */

/**
 * Spend threshold configuration
 */
export interface SpendThreshold {
  /** Amount in dollars */
  amount: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Action to take when exceeded */
  action: 'alert' | 'suspend' | 'alert_and_suspend';
}

/**
 * Circuit breaker state for a user/org
 */
export interface CircuitBreakerState {
  userId: string;
  orgId?: string;
  currentSpend: number;
  windowStart: number;
  isSuspended: boolean;
  suspendedAt?: number;
  suspendedReason?: string;
  alerts: AlertRecord[];
}

/**
 * Alert record
 */
export interface AlertRecord {
  timestamp: number;
  threshold: number;
  actualSpend: number;
  action: string;
}

/**
 * Admin override record
 */
export interface AdminOverride {
  userId: string;
  adminId: string;
  overrideAt: number;
  expiresAt?: number;
  reason: string;
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: Record<string, SpendThreshold> = {
  // Alert when user spends > $50 in an hour
  userHourlyAlert: {
    amount: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    action: 'alert',
  },
  // Suspend when user spends > $100 in an hour
  userHourlySuspend: {
    amount: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    action: 'suspend',
  },
  // Alert and suspend for extreme usage
  userDailyCritical: {
    amount: 500,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    action: 'alert_and_suspend',
  },
  // Org-level daily budget
  orgDailyBudget: {
    amount: 1000,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    action: 'alert_and_suspend',
  },
};

// In-memory stores (use Redis in production)
const stateStore = new Map<string, CircuitBreakerState>();
const overrideStore = new Map<string, AdminOverride>();
const alertCallbacks: Array<(state: CircuitBreakerState, threshold: SpendThreshold) => void> = [];

/**
 * Reset all state (for testing)
 */
export function resetCircuitBreaker(): void {
  stateStore.clear();
  overrideStore.clear();
  alertCallbacks.length = 0;
}

/**
 * Register an alert callback
 */
export function onAlert(
  callback: (state: CircuitBreakerState, threshold: SpendThreshold) => void
): void {
  alertCallbacks.push(callback);
}

/**
 * Get or create circuit breaker state
 */
function getOrCreateState(userId: string, orgId?: string): CircuitBreakerState {
  const key = orgId ? `org:${orgId}` : `user:${userId}`;
  
  if (!stateStore.has(key)) {
    stateStore.set(key, {
      userId,
      orgId,
      currentSpend: 0,
      windowStart: Date.now(),
      isSuspended: false,
      alerts: [],
    });
  }
  
  return stateStore.get(key)!;
}

/**
 * Record a spend event
 */
export function recordSpend(
  userId: string,
  amount: number,
  orgId?: string,
  thresholds: SpendThreshold[] = Object.values(DEFAULT_THRESHOLDS)
): { allowed: boolean; reason?: string } {
  const state = getOrCreateState(userId, orgId);
  const now = Date.now();

  // Check for admin override
  const override = getAdminOverride(userId);
  if (override && (!override.expiresAt || override.expiresAt > now)) {
    // Admin override active - allow without checks
    return { allowed: true };
  }

  // Check if already suspended
  if (state.isSuspended) {
    return {
      allowed: false,
      reason: state.suspendedReason || 'Account suspended due to excessive usage',
    };
  }

  // Add new spend
  state.currentSpend += amount;

  // Check each threshold
  for (const threshold of thresholds) {
    // Reset window if needed
    if (now - state.windowStart >= threshold.windowMs) {
      state.currentSpend = amount; // Reset with current spend
      state.windowStart = now;
    }

    // Check if threshold exceeded
    if (state.currentSpend > threshold.amount) {
      const alertRecord: AlertRecord = {
        timestamp: now,
        threshold: threshold.amount,
        actualSpend: state.currentSpend,
        action: threshold.action,
      };

      state.alerts.push(alertRecord);

      // Trigger alert callback
      alertCallbacks.forEach((cb) => cb(state, threshold));

      if (threshold.action === 'suspend' || threshold.action === 'alert_and_suspend') {
        state.isSuspended = true;
        state.suspendedAt = now;
        state.suspendedReason = `Spend $${state.currentSpend.toFixed(2)} exceeded threshold $${threshold.amount}`;

        return {
          allowed: false,
          reason: state.suspendedReason,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Check if account is suspended
 */
export function isSuspended(userId: string, orgId?: string): boolean {
  const key = orgId ? `org:${orgId}` : `user:${userId}`;
  const state = stateStore.get(key);
  
  if (!state) return false;

  // Check for admin override
  const override = getAdminOverride(userId);
  if (override && (!override.expiresAt || override.expiresAt > Date.now())) {
    return false;
  }

  return state.isSuspended;
}

/**
 * Get current spend for user/org
 */
export function getCurrentSpend(userId: string, orgId?: string): number {
  const key = orgId ? `org:${orgId}` : `user:${userId}`;
  const state = stateStore.get(key);
  return state?.currentSpend ?? 0;
}

/**
 * Get circuit breaker state
 */
export function getState(userId: string, orgId?: string): CircuitBreakerState | undefined {
  const key = orgId ? `org:${orgId}` : `user:${userId}`;
  return stateStore.get(key);
}

/**
 * Set admin override
 */
export function setAdminOverride(
  userId: string,
  adminId: string,
  reason: string,
  expiresInMs?: number
): AdminOverride {
  const override: AdminOverride = {
    userId,
    adminId,
    overrideAt: Date.now(),
    expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
    reason,
  };

  overrideStore.set(userId, override);

  // Also unsuspend the user
  const state = stateStore.get(`user:${userId}`);
  if (state) {
    state.isSuspended = false;
  }

  return override;
}

/**
 * Get admin override for user
 */
export function getAdminOverride(userId: string): AdminOverride | undefined {
  return overrideStore.get(userId);
}

/**
 * Remove admin override
 */
export function removeAdminOverride(userId: string): void {
  overrideStore.delete(userId);
}

/**
 * Manually suspend account
 */
export function suspendAccount(userId: string, reason: string, orgId?: string): void {
  const state = getOrCreateState(userId, orgId);
  state.isSuspended = true;
  state.suspendedAt = Date.now();
  state.suspendedReason = reason;
}

/**
 * Manually unsuspend account
 */
export function unsuspendAccount(userId: string, orgId?: string): void {
  const state = getOrCreateState(userId, orgId);
  state.isSuspended = false;
  state.suspendedAt = undefined;
  state.suspendedReason = undefined;
}

/**
 * Get alerts for user
 */
export function getAlerts(userId: string, orgId?: string): AlertRecord[] {
  const key = orgId ? `org:${orgId}` : `user:${userId}`;
  const state = stateStore.get(key);
  return state?.alerts ?? [];
}

/**
 * Estimate cost from token usage
 */
export function estimateCostFromTokens(
  inputTokens: number,
  outputTokens: number,
  modelPricing: { inputPer1k: number; outputPer1k: number } = {
    inputPer1k: 0.00125, // Gemini 3 Pro pricing estimate
    outputPer1k: 0.005,
  }
): number {
  const inputCost = (inputTokens / 1000) * modelPricing.inputPer1k;
  const outputCost = (outputTokens / 1000) * modelPricing.outputPer1k;
  return inputCost + outputCost;
}
