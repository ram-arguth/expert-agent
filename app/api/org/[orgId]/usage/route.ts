/**
 * Org Usage Analytics API
 *
 * Returns per-user and per-agent token consumption stats.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized, CedarActions } from "@/lib/authz/cedar";

// =============================================================================
// Types
// =============================================================================

interface UserUsage {
  userId: string;
  userName: string | null;
  userEmail: string;
  tokensUsed: number;
  queryCount: number;
  percentage: number;
}

interface AgentUsage {
  agentId: string;
  agentName: string;
  tokensUsed: number;
  queryCount: number;
  percentage: number;
}

interface UsageAnalytics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    tokensUsed: number;
    queryCount: number;
  };
  byUser: UserUsage[];
  byAgent: AgentUsage[];
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // 2. Check membership and admin role
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 },
      );
    }

    // 3. Authorize - admin/owner can view analytics
    const authzDecision = isAuthorized({
      principal: {
        type: "User",
        id: session.user.id,
        attributes: {
          roles: { [orgId]: membership.role },
        },
      },
      action: { type: "Action", id: CedarActions.ViewUsage },
      resource: { type: "Org", id: orgId },
    });

    if (!authzDecision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Parse date range (default: last 30 days)
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);
    const validDays = Math.min(Math.max(days, 1), 365);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validDays);

    // 5. Get org members for joining
    const members = await prisma.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const memberIds = members.map((m) => m.userId);

    // 6. Aggregate usage by user
    const usageByUser = await prisma.usageRecord.groupBy({
      by: ["userId"],
      where: {
        userId: { in: memberIds },
        orgId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { inputTokens: true, outputTokens: true },
      _count: { id: true },
    });

    // 7. Aggregate usage by agent
    const usageByAgent = await prisma.usageRecord.groupBy({
      by: ["agentId"],
      where: {
        orgId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { inputTokens: true, outputTokens: true },
      _count: { id: true },
    });

    // 8. Calculate totals
    const totalTokens = usageByUser.reduce(
      (sum, u) => sum + (u._sum.inputTokens || 0) + (u._sum.outputTokens || 0),
      0,
    );
    const totalQueries = usageByUser.reduce((sum, u) => sum + u._count.id, 0);

    // 9. Build response
    const userMap = new Map(members.map((m) => [m.userId, m.user]));

    const byUser: UserUsage[] = usageByUser
      .map((u) => {
        const user = userMap.get(u.userId);
        const tokens = (u._sum.inputTokens || 0) + (u._sum.outputTokens || 0);
        return {
          userId: u.userId,
          userName: user?.name || null,
          userEmail: user?.email || "Unknown",
          tokensUsed: tokens,
          queryCount: u._count.id,
          percentage:
            totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0,
        };
      })
      .sort((a, b) => b.tokensUsed - a.tokensUsed);

    const byAgent: AgentUsage[] = usageByAgent
      .map((a) => {
        const tokens = (a._sum.inputTokens || 0) + (a._sum.outputTokens || 0);
        return {
          agentId: a.agentId,
          agentName: formatAgentName(a.agentId),
          tokensUsed: tokens,
          queryCount: a._count.id,
          percentage:
            totalTokens > 0 ? Math.round((tokens / totalTokens) * 100) : 0,
        };
      })
      .sort((a, b) => b.tokensUsed - a.tokensUsed);

    const analytics: UsageAnalytics = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: validDays,
      },
      totals: {
        tokensUsed: totalTokens,
        queryCount: totalQueries,
      },
      byUser,
      byAgent,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Usage analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// =============================================================================
// Helpers
// =============================================================================

function formatAgentName(agentId: string): string {
  // Convert kebab-case to Title Case
  return agentId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
