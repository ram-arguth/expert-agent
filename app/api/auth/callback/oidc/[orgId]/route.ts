/**
 * OIDC Callback Handler
 *
 * Handles OIDC authentication callback from enterprise IdPs.
 *
 * @see docs/IMPLEMENTATION.md - Phase 1.3
 */

import { NextRequest, NextResponse } from "next/server";
import { handleOIDCCallback } from "@/lib/auth/sso-service";
import { prisma } from "@/lib/db";

interface Params {
  orgId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  try {
    const { orgId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Check for error from IdP
    const error = searchParams.get("error");
    if (error) {
      const errorDescription =
        searchParams.get("error_description") || "Unknown error";
      console.error(`OIDC error from IdP: ${error} - ${errorDescription}`);
      return NextResponse.redirect(
        new URL(
          `/auth/error?message=${encodeURIComponent(errorDescription)}`,
          request.url,
        ),
      );
    }

    // Handle callback
    const userInfo = await handleOIDCCallback(orgId, searchParams);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (!user) {
      // Create user from SSO
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          authProvider: "oidc",
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

    // Create session (normally handled by NextAuth)
    // For SSO, we redirect with a special token
    const ssoToken = await createSSOToken(user.id, orgId);

    return NextResponse.redirect(
      new URL(`/api/auth/sso-complete?token=${ssoToken}`, request.url),
    );
  } catch (error) {
    console.error("OIDC callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          error instanceof Error ? error.message : "OIDC authentication failed",
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
