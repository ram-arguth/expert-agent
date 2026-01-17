/**
 * Audit Logs API
 *
 * Returns audit logs for an organization (admin only).
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.2
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized, CedarActions } from "@/lib/authz/cedar";
import { getAuditLogs, type AuditLogFilters } from "@/lib/audit/audit-service";
import type { AuditAction } from "@prisma/client";

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

    // 2. Check membership
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

    // 3. Authorize - only admin/owner can view audit logs
    const decision = isAuthorized({
      principal: {
        type: "User",
        id: session.user.id,
        attributes: {
          roles: { [orgId]: membership.role },
        },
      },
      action: { type: "Action", id: CedarActions.ViewAuditLog },
      resource: { type: "Org", id: orgId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(
      parseInt(searchParams.get("pageSize") || "50", 10),
      100,
    );

    const filters: AuditLogFilters = {};

    const userId = searchParams.get("userId");
    if (userId) filters.userId = userId;

    const action = searchParams.get("action");
    if (action) filters.action = action as AuditAction;

    const resourceType = searchParams.get("resourceType");
    if (resourceType) filters.resourceType = resourceType;

    const startDate = searchParams.get("startDate");
    if (startDate) filters.startDate = new Date(startDate);

    const endDate = searchParams.get("endDate");
    if (endDate) filters.endDate = new Date(endDate);

    const success = searchParams.get("success");
    if (success !== null) filters.success = success === "true";

    // 5. Get audit logs
    const result = await getAuditLogs(orgId, filters, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
