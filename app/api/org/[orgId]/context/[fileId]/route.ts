/**
 * Organization Context File Delete API
 *
 * DELETE /api/org/:orgId/context/:fileId - Delete a context file (admin only)
 *
 * Removes the file from both GCS and the database.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.2 Org Context Files
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";
import { Storage } from "@google-cloud/storage";

// =============================================================================
// Types
// =============================================================================

type RouteContext = {
  params: Promise<{ orgId: string; fileId: string }>;
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if user has admin privileges (OWNER or ADMIN) for the org
 */
async function checkAdminPrivileges(
  userId: string,
  orgId: string,
): Promise<{ hasAccess: boolean; membership: { role: string } | null }> {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: { userId, orgId },
    },
    select: { role: true },
  });

  if (!membership) {
    return { hasAccess: false, membership: null };
  }

  const adminRoles = ["OWNER", "ADMIN"];
  return {
    hasAccess: adminRoles.includes(membership.role),
    membership,
  };
}

/**
 * Get GCS storage client
 */
function getStorage(): Storage {
  return new Storage();
}

/**
 * Delete file from GCS
 */
async function deleteFromGCS(gcsPath: string): Promise<void> {
  const storage = getStorage();
  const bucket = storage.bucket(
    process.env.GCS_BUCKET_NAME || "expert-ai-uploads",
  );

  try {
    await bucket.file(gcsPath).delete();
  } catch (error) {
    // Log but don't fail if GCS delete fails (file might not exist)
    console.warn(`Failed to delete file from GCS: ${gcsPath}`, error);
  }
}

// =============================================================================
// DELETE /api/org/:orgId/context/:fileId - Delete a context file
// =============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { orgId, fileId } = await context.params;

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Check admin privileges
    const { hasAccess, membership } = await checkAdminPrivileges(
      session.user.id,
      orgId,
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden", message: "Not a member of this organization" },
        { status: 403 },
      );
    }

    if (!hasAccess) {
      // Log Cedar check for audit
      const cedar = getCedarEngine();
      cedar.isAuthorized({
        principal: {
          type: "User",
          id: session.user.id,
          attributes: { orgIds: [orgId], roles: { [orgId]: membership.role } },
        },
        action: { type: "Action", id: CedarActions.ManageContextFiles },
        resource: { type: "Org", id: orgId },
      });

      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Only owners and admins can delete context files",
        },
        { status: 403 },
      );
    }

    // 3. Find the context file
    const contextFile = await prisma.contextFile.findUnique({
      where: { id: fileId },
    });

    if (!contextFile) {
      return NextResponse.json(
        { error: "Not Found", message: "Context file not found" },
        { status: 404 },
      );
    }

    // 4. Verify the file belongs to this org
    if (contextFile.orgId !== orgId) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Context file does not belong to this organization",
        },
        { status: 403 },
      );
    }

    // 5. Delete from GCS first (best effort)
    await deleteFromGCS(contextFile.gcsPath);

    // 6. Delete from database
    await prisma.contextFile.delete({
      where: { id: fileId },
    });

    // 7. Return success
    return NextResponse.json({
      message: "Context file deleted successfully",
      fileId,
    });
  } catch (error) {
    console.error("Error deleting context file:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to delete context file",
      },
      { status: 500 },
    );
  }
}
