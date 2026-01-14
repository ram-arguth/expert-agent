/**
 * Rate Limiter
 *
 * Configurable per-user and per-org rate limits with tiered support.
 * Uses in-memory storage for development and Redis for production.
 *
 * @see docs/IMPEMENTATION.md - Phase 0.8 Security & Compliance
 */

/**
 * Rate limit configuration per tier
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the window */
  remaining: number;
  /** Milliseconds until the window resets */
  resetInMs: number;
  /** Total limit for the tier */
  limit: number;
}

/**
 * Rate limit entry (stored per key)
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Tier definitions for rate limiting
 */
export type RateLimitTier = 'free' | 'pro' | 'enterprise' | 'admin';

/**
 * Default rate limits per tier (requests per hour)
 */
export const DEFAULT_RATE_LIMITS: Record<RateLimitTier, RateLimitConfig> = {
  free: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  pro: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  enterprise: {
    maxRequests: 10000,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  admin: {
    maxRequests: Infinity, // No limit for admins
    windowMs: 60 * 60 * 1000,
  },
};

/**
 * In-memory rate limiter store (for development/testing)
 * In production, use Redis or similar distributed store
 */
class RateLimiterStore {
  private store: Map<string, RateLimitEntry> = new Map();

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Global store instance
let store: RateLimiterStore = new RateLimiterStore();

/**
 * Reset the rate limiter store (for testing)
 */
export function resetRateLimiter(): void {
  store = new RateLimiterStore();
}

/**
 * Check rate limit for a given key
 *
 * @param key - Unique identifier (user ID, org ID, IP, etc.)
 * @param tier - Rate limit tier
 * @param customLimits - Optional custom limits (overrides tier defaults)
 * @returns RateLimitResult with allowed status and metadata
 */
export function checkRateLimit(
  key: string,
  tier: RateLimitTier = 'free',
  customLimits?: RateLimitConfig
): RateLimitResult {
  const config = customLimits ?? DEFAULT_RATE_LIMITS[tier];
  const now = Date.now();

  // Admin tier has no limits
  if (config.maxRequests === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      resetInMs: 0,
      limit: Infinity,
    };
  }

  const entry = store.get(key);

  // No entry or window expired - start new window
  if (!entry || now - entry.windowStart >= config.windowMs) {
    store.set(key, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetInMs: config.windowMs,
      limit: config.maxRequests,
    };
  }

  // Within window - check count
  const resetInMs = config.windowMs - (now - entry.windowStart);

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs,
      limit: config.maxRequests,
    };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetInMs,
    limit: config.maxRequests,
  };
}

/**
 * Create a rate limit key for a user
 */
export function userRateLimitKey(userId: string, action?: string): string {
  return action ? `user:${userId}:${action}` : `user:${userId}`;
}

/**
 * Create a rate limit key for an organization
 */
export function orgRateLimitKey(orgId: string, action?: string): string {
  return action ? `org:${orgId}:${action}` : `org:${orgId}`;
}

/**
 * Create a rate limit key for an IP address
 */
export function ipRateLimitKey(ip: string, action?: string): string {
  return action ? `ip:${ip}:${action}` : `ip:${ip}`;
}

/**
 * Get rate limit tier from subscription plan
 */
export function getTierFromPlan(plan?: string | null): RateLimitTier {
  switch (plan?.toLowerCase()) {
    case 'enterprise':
      return 'enterprise';
    case 'pro':
    case 'professional':
      return 'pro';
    case 'admin':
      return 'admin';
    default:
      return 'free';
  }
}

/**
 * Rate limiter middleware helper for Next.js API routes
 */
export interface RateLimitMiddlewareOptions {
  /** Key to use for rate limiting (user ID, org ID, IP, etc.) */
  key: string;
  /** Rate limit tier */
  tier?: RateLimitTier;
  /** Custom limits (overrides tier) */
  customLimits?: RateLimitConfig;
  /** Action name for more granular limiting */
  action?: string;
}

/**
 * Check rate limit and return headers for response
 */
export function checkRateLimitWithHeaders(
  options: RateLimitMiddlewareOptions
): { result: RateLimitResult; headers: Record<string, string> } {
  const { key, tier = 'free', customLimits, action } = options;
  const fullKey = action ? `${key}:${action}` : key;

  const result = checkRateLimit(fullKey, tier, customLimits);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000 + result.resetInMs / 1000)),
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(Math.ceil(result.resetInMs / 1000));
  }

  return { result, headers };
}
