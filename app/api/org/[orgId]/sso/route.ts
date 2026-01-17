/**
 * SSO Configuration API
 *
 * Manages SSO provider configuration for enterprise orgs.
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized, CedarActions } from "@/lib/authz/cedar";
import { z } from "zod";

// =============================================================================
// Schemas
// =============================================================================

const SSOConfigSchema = z.object({
  provider: z.enum(["saml", "oidc"]),
  // SAML fields
  entityId: z.string().optional(),
  ssoUrl: z.string().url().optional(),
  certificate: z.string().optional(),
  // OIDC fields
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  issuerUrl: z.string().url().optional(),
});

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Check membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: session.user.id, orgId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Authorize
    const decision = isAuthorized({
      principal: {
        type: "User",
        id: session.user.id,
        attributes: { roles: { [orgId]: membership.role } },
      },
      action: { type: "Action", id: CedarActions.ConfigureSSO },
      resource: { type: "Org", id: orgId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get org with SSO config
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        domain: true,
        domainVerified: true,
        verificationToken: true,
        ssoConfig: true,
        type: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      domain: org.domain,
      domainVerified: org.domainVerified,
      verificationToken: org.verificationToken,
      ssoConfig: org.ssoConfig,
      isEnterprise: org.type === "ENTERPRISE",
    });
  } catch (error) {
    console.error("SSO config GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;

    // Check membership
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: { userId: session.user.id, orgId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Authorize
    const decision = isAuthorized({
      principal: {
        type: "User",
        id: session.user.id,
        attributes: { roles: { [orgId]: membership.role } },
      },
      action: { type: "Action", id: CedarActions.ConfigureSSO },
      resource: { type: "Org", id: orgId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const result = SSOConfigSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid SSO configuration", details: result.error.flatten() },
        { status: 400 },
      );
    }

    // Update org SSO config
    const org = await prisma.org.update({
      where: { id: orgId },
      data: {
        ssoConfig: result.data,
        type: "ENTERPRISE", // Upgrade to enterprise when SSO configured
      },
      select: {
        id: true,
        ssoConfig: true,
        type: true,
      },
    });

    return NextResponse.json({
      message: "SSO configuration saved",
      ssoConfig: org.ssoConfig,
    });
  } catch (error) {
    console.error("SSO config POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
