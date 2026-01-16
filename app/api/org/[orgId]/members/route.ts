/**
 * Organization Members API
 *
 * GET /api/org/:orgId/members - List all members of an organization
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

/**
 * GET /api/org/:orgId/members
 * Lists all members of the organization with their user details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Verify user is a member of this org
    const userMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    if (!userMembership) {
      // Perform Cedar check for audit trail
      const cedar = getCedarEngine();
      cedar.isAuthorized({
        principal: {
          type: "User",
          id: session.user.id,
          attributes: { orgIds: [], roles: {} },
        },
        action: { type: "Action", id: CedarActions.GetOrg },
        resource: { type: "Org", id: orgId },
      });

      return NextResponse.json(
        { error: "Forbidden", message: "Not a member of this organization" },
        { status: 403 },
      );
    }

    // 3. Fetch all members with user details
    const memberships = await prisma.membership.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // OWNER, then ADMIN, then MEMBER
        { createdAt: "asc" },
      ],
    });

    // Transform to expected format
    const members = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      },
    }));

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list members" },
      { status: 500 },
    );
  }
}
