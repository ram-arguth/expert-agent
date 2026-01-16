/**
 * Usage API - Get Token Usage Summary
 *
 * GET /api/billing/usage - Get current token usage for the authenticated user
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.3
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUsageSummary } from "@/lib/billing/quota-service";

export async function GET(_request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Get user's active org (if any)
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      select: { orgId: true },
    });

    const orgId = membership?.orgId ?? null;

    // 3. Get usage summary
    const summary = await getUsageSummary(session.user.id, orgId);

    return NextResponse.json({
      tokensRemaining: summary.tokensRemaining,
      tokensMonthly: summary.tokensMonthly,
      usagePercent: summary.usagePercent,
      quotaResetDate: summary.quotaResetDate?.toISOString() ?? null,
      plan: summary.plan,
      isOrgContext: summary.isOrgContext,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch usage" },
      { status: 500 },
    );
  }
}
