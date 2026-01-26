/**
 * Share API - Create and Manage Share Links
 *
 * POST /api/share - Create a share link for a session/artifact
 * GET /api/share?token=xxx - Access shared content via token
 * DELETE /api/share?id=xxx - Revoke a share link
 *
 * @see docs/DESIGN.md - Export & Share
 * @see docs/IMPEMENTATION.md - Phase 4.7
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";
import { randomBytes } from "crypto";

// ============================================
// Request Schemas
// ============================================

const CreateShareLinkSchema = z.object({
  sessionId: z.string().uuid(),
  visibility: z.enum(["PRIVATE", "TEAM", "ORG"]).default("PRIVATE"),
  expiresInDays: z.number().min(1).max(365).optional(),
  allowedEmails: z.array(z.string().email()).optional(),
});

const AccessShareSchema = z.object({
  token: z.string().min(32).max(64),
});

// ============================================
// POST /api/share - Create share link
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const parseResult = CreateShareLinkSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid request body",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { sessionId, visibility, expiresInDays, allowedEmails } =
      parseResult.data;

    // 3. Verify session exists and user owns it
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, orgId: true },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: "Not Found", message: "Session not found" },
        { status: 404 },
      );
    }

    // 4. Authorize - user can only share their own sessions
    // Primary check: ownership
    if (targetSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden", message: "Not authorized to share this session" },
        { status: 403 },
      );
    }

    // Cedar authorization for audit trail
    const cedar = getCedarEngine();
    cedar.isAuthorized({
      principal: { type: "User", id: session.user.id },
      action: { type: "Action", id: CedarActions.CreateShareLink },
      resource: {
        type: "Session",
        id: sessionId,
        attributes: { ownerId: targetSession.userId },
      },
    });

    // 5. Generate unique token
    const token = randomBytes(32).toString("hex");

    // 6. Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // 7. Create share link
    const shareLink = await prisma.shareLink.create({
      data: {
        sessionId,
        createdBy: session.user.id,
        token,
        visibility,
        allowedOrgId:
          visibility === "TEAM" || visibility === "ORG"
            ? targetSession.orgId
            : null,
        allowedEmails: allowedEmails || [],
        expiresAt,
      },
    });

    // 8. Build share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/share/${token}`;

    return NextResponse.json({
      id: shareLink.id,
      url: shareUrl,
      token: shareLink.token,
      visibility: shareLink.visibility,
      expiresAt: shareLink.expiresAt?.toISOString() || null,
      createdAt: shareLink.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to create share link",
      },
      { status: 500 },
    );
  }
}

// ============================================
// GET /api/share?token=xxx - Access shared content
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Bad Request", message: "Token is required" },
        { status: 400 },
      );
    }

    // 1. Find share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        session: {
          include: {
            messages: {
              where: { role: "AGENT" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: "Not Found", message: "Share link not found" },
        { status: 404 },
      );
    }

    // 2. Check if revoked
    if (shareLink.isRevoked) {
      return NextResponse.json(
        { error: "Gone", message: "Share link has been revoked" },
        { status: 410 },
      );
    }

    // 3. Check expiration
    if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Gone", message: "Share link has expired" },
        { status: 410 },
      );
    }

    // 4. Check visibility-based access
    const session = await auth();
    const userId = session?.user?.id;

    if (shareLink.visibility === "TEAM" || shareLink.visibility === "ORG") {
      if (!userId) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required for this share link",
          },
          { status: 401 },
        );
      }

      // Check if user is member of the allowed org
      if (shareLink.allowedOrgId) {
        const membership = await prisma.membership.findFirst({
          where: {
            userId,
            orgId: shareLink.allowedOrgId,
          },
        });

        if (!membership) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "You are not a member of the required organization",
            },
            { status: 403 },
          );
        }
      }
    }

    // 5. For PRIVATE with allowedEmails, check email
    if (
      shareLink.visibility === "PRIVATE" &&
      shareLink.allowedEmails.length > 0
    ) {
      if (!userId) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user || !shareLink.allowedEmails.includes(user.email)) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message: "You are not authorized to access this share link",
          },
          { status: 403 },
        );
      }
    }

    // 6. Update access count
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    // 7. Return shared content
    const lastMessage = shareLink.session.messages[0];

    return NextResponse.json({
      sessionId: shareLink.session.id,
      agentId: shareLink.session.agentId,
      content: lastMessage?.content || "",
      jsonData: lastMessage?.jsonData || null,
      visibility: shareLink.visibility,
      createdAt: shareLink.session.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error accessing share link:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to access share link",
      },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE /api/share?id=xxx - Revoke share link
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Get share link ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Bad Request", message: "Share link ID is required" },
        { status: 400 },
      );
    }

    // 3. Find share link
    const shareLink = await prisma.shareLink.findUnique({
      where: { id },
      select: { createdBy: true, isRevoked: true },
    });

    if (!shareLink) {
      return NextResponse.json(
        { error: "Not Found", message: "Share link not found" },
        { status: 404 },
      );
    }

    // 4. Authorize - only creator can revoke
    // Primary check: ownership
    if (shareLink.createdBy !== session.user.id) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Not authorized to revoke this share link",
        },
        { status: 403 },
      );
    }

    // Cedar authorization for audit trail
    const cedar = getCedarEngine();
    cedar.isAuthorized({
      principal: { type: "User", id: session.user.id },
      action: { type: "Action", id: CedarActions.RevokeShareLink },
      resource: {
        type: "Session",
        id,
        attributes: { ownerId: shareLink.createdBy },
      },
    });

    // 5. Check if already revoked
    if (shareLink.isRevoked) {
      return NextResponse.json(
        { error: "Conflict", message: "Share link already revoked" },
        { status: 409 },
      );
    }

    // 6. Revoke share link
    await prisma.shareLink.update({
      where: { id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Share link revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to revoke share link",
      },
      { status: 500 },
    );
  }
}
