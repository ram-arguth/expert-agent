/**
 * Token Quota Service
 *
 * Manages token quota checking and deduction for billing enforcement.
 *
 * @see docs/DESIGN.md - Billing section
 * @see docs/IMPLEMENTATION.md - Phase 5.3 Quota Enforcement
 */

import { prisma } from "@/lib/db";

// =============================================================================
// Types
// =============================================================================

export interface QuotaCheckResult {
  /** Whether the user/org has tokens remaining */
  allowed: boolean;

  /** Current tokens remaining */
  tokensRemaining: number;

  /** Monthly quota limit */
  tokensMonthly: number;

  /** Percentage used (0-100) */
  usagePercent: number;

  /** Context: 'user' | 'org' */
  context: "user" | "org";

  /** If not allowed, reason for denial */
  reason?: string;

  /** If not allowed, upgrade prompt */
  upgradePrompt?: string;
}

export interface UsageSummary {
  /** Current tokens remaining */
  tokensRemaining: number;

  /** Monthly quota limit */
  tokensMonthly: number;

  /** Percentage used (0-100) */
  usagePercent: number;

  /** When quota resets */
  quotaResetDate: Date | null;

  /** Current plan name */
  plan: string;

  /** Whether user is in org context */
  isOrgContext: boolean;
}

export interface DeductResult {
  /** Whether deduction succeeded */
  success: boolean;

  /** New balance after deduction */
  newBalance: number;

  /** Error if failed */
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PLAN_QUOTAS: Record<string, number> = {
  free: 1000,
  pro: 50000,
  enterprise: 500000,
};

const LOW_USAGE_THRESHOLD = 0.1; // 10% remaining

// =============================================================================
// Quota Service
// =============================================================================

/**
 * Check if user/org has sufficient token quota
 */
export async function checkQuota(
  userId: string,
  orgId: string | null,
  estimatedTokens: number = 0,
): Promise<QuotaCheckResult> {
  // If in org context, check org quota
  if (orgId) {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        tokensRemaining: true,
        tokensMonthly: true,
        plan: true,
        quotaResetDate: true,
      },
    });

    if (!org) {
      return {
        allowed: false,
        tokensRemaining: 0,
        tokensMonthly: 0,
        usagePercent: 100,
        context: "org",
        reason: "Organization not found",
      };
    }

    const usagePercent =
      org.tokensMonthly > 0
        ? Math.round(
            ((org.tokensMonthly - org.tokensRemaining) / org.tokensMonthly) *
              100,
          )
        : 0;

    if (org.tokensRemaining <= 0) {
      return {
        allowed: false,
        tokensRemaining: org.tokensRemaining,
        tokensMonthly: org.tokensMonthly,
        usagePercent,
        context: "org",
        reason: "Token quota exceeded",
        upgradePrompt:
          org.plan === "free"
            ? "Upgrade to Pro for more tokens"
            : "Contact sales to increase your quota",
      };
    }

    if (estimatedTokens > 0 && org.tokensRemaining < estimatedTokens) {
      return {
        allowed: false,
        tokensRemaining: org.tokensRemaining,
        tokensMonthly: org.tokensMonthly,
        usagePercent,
        context: "org",
        reason: `Insufficient tokens. Need ~${estimatedTokens}, have ${org.tokensRemaining}`,
        upgradePrompt: "Upgrade your plan for more tokens",
      };
    }

    return {
      allowed: true,
      tokensRemaining: org.tokensRemaining,
      tokensMonthly: org.tokensMonthly,
      usagePercent,
      context: "org",
    };
  }

  // Personal context - check user's personal quota
  // For now, personal users use a default free tier quota
  // In future, users can have individual subscriptions
  const PERSONAL_QUOTA = PLAN_QUOTAS.free;

  // TODO: Store personal token usage in User model or separate table
  // For now, return allowed for personal context
  return {
    allowed: true,
    tokensRemaining: PERSONAL_QUOTA,
    tokensMonthly: PERSONAL_QUOTA,
    usagePercent: 0,
    context: "user",
  };
}

/**
 * Deduct tokens after successful query
 */
export async function deductTokens(
  userId: string,
  orgId: string | null,
  actualTokens: number,
): Promise<DeductResult> {
  if (actualTokens <= 0) {
    return { success: true, newBalance: 0 };
  }

  if (orgId) {
    try {
      // Atomic decrement using Prisma transaction
      const org = await prisma.org.update({
        where: { id: orgId },
        data: {
          tokensRemaining: {
            decrement: actualTokens,
          },
        },
        select: {
          tokensRemaining: true,
        },
      });

      return {
        success: true,
        newBalance: Math.max(0, org.tokensRemaining),
      };
    } catch (error) {
      console.error("Failed to deduct tokens:", error);
      return {
        success: false,
        newBalance: 0,
        error:
          error instanceof Error ? error.message : "Token deduction failed",
      };
    }
  }

  // Personal context - for now, no deduction
  // TODO: Implement personal token tracking
  return { success: true, newBalance: PLAN_QUOTAS.free };
}

/**
 * Get usage summary for display in UI
 */
export async function getUsageSummary(
  userId: string,
  orgId: string | null,
): Promise<UsageSummary> {
  if (orgId) {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        tokensRemaining: true,
        tokensMonthly: true,
        quotaResetDate: true,
        plan: true,
      },
    });

    if (!org) {
      return {
        tokensRemaining: 0,
        tokensMonthly: 0,
        usagePercent: 100,
        quotaResetDate: null,
        plan: "free",
        isOrgContext: true,
      };
    }

    const usagePercent =
      org.tokensMonthly > 0
        ? Math.round(
            ((org.tokensMonthly - org.tokensRemaining) / org.tokensMonthly) *
              100,
          )
        : 0;

    return {
      tokensRemaining: org.tokensRemaining,
      tokensMonthly: org.tokensMonthly,
      usagePercent,
      quotaResetDate: org.quotaResetDate,
      plan: org.plan,
      isOrgContext: true,
    };
  }

  // Personal context
  return {
    tokensRemaining: PLAN_QUOTAS.free,
    tokensMonthly: PLAN_QUOTAS.free,
    usagePercent: 0,
    quotaResetDate: null,
    plan: "free",
    isOrgContext: false,
  };
}

/**
 * Check if usage is low (warning threshold)
 */
export function isLowUsage(usagePercent: number): boolean {
  return usagePercent >= (1 - LOW_USAGE_THRESHOLD) * 100;
}

/**
 * Reset quota for an org (called by billing webhook on renewal)
 */
export async function resetQuota(orgId: string, plan: string): Promise<void> {
  const monthlyQuota = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;

  await prisma.org.update({
    where: { id: orgId },
    data: {
      tokensRemaining: monthlyQuota,
      tokensMonthly: monthlyQuota,
      quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      plan,
    },
  });
}

/**
 * Get plan quotas configuration
 */
export function getPlanQuotas(): Record<string, number> {
  return { ...PLAN_QUOTAS };
}
