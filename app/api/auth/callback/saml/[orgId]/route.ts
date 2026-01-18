/**
 * SAML Callback Handler
 *
 * Handles SAML authentication callback from enterprise IdPs.
 *
 * @see docs/IMPLEMENTATION.md - Phase 1.3
 */

import { NextRequest, NextResponse } from "next/server";
import { handleSAMLCallback } from "@/lib/auth/sso-service";
import { prisma } from "@/lib/db";

interface Params {
  orgId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { orgId } = await params;
    const formData = await request.formData();

    // Get SAML response from form data
    const samlResponse = formData.get("SAMLResponse");
    if (!samlResponse || typeof samlResponse !== "string") {
      return NextResponse.redirect(
        new URL("/auth/error?message=Missing+SAML+response", request.url),
      );
    }

    // Cedar authorization with Anonymous principal (IdP-initiated callback)
    const { cedar } = await import("@/lib/authz/cedar");
    const decision = cedar.isAuthorized({
      principal: { type: "Anonymous", id: "sso-callback" },
      action: { type: "Action", id: "SSOCallback" },
      resource: { type: "Org", id: orgId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.redirect(
        new URL("/auth/error?message=Unauthorized", request.url),
      );
    }

    // Handle callback
    const userInfo = await handleSAMLCallback(orgId, samlResponse);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!user) {
      // Create user from SAML SSO
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          authProvider: "saml",
        },
      });
    }

    // Ensure user is member of org
    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: orgId,
        },
      },
    });

    if (!membership) {
      // Auto-join org on SSO login
      await prisma.membership.create({
        data: {
          userId: user.id,
          orgId: orgId,
          role: "MEMBER",
        },
      });
    }

    // Create session token
    const ssoToken = await createSSOToken(user.id, orgId);

    return NextResponse.redirect(
      new URL(`/api/auth/sso-complete?token=${ssoToken}`, request.url),
    );
  } catch (error) {
    console.error("SAML callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          error instanceof Error ? error.message : "SAML authentication failed",
        )}`,
        request.url,
      ),
    );
  }
}

// Helper to create temporary SSO token for session creation
// Note: In production, integrate with NextAuth.js session handling
async function createSSOToken(userId: string, _orgId: string): Promise<string> {
  // For now, just return a simple token that the sso-complete endpoint will verify
  // In production, use a proper token storage mechanism
  const token = `${userId}:${Date.now()}`;
  return Buffer.from(token).toString("base64");
}
