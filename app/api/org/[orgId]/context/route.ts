/**
 * Organization Context Files API
 *
 * POST /api/org/:orgId/context - Upload a context file (admin only)
 * GET /api/org/:orgId/context - List context files
 *
 * Context files are organization-level documents that can be automatically
 * included in agent prompts for all queries made within that organization.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.2 Org Context Files
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";
import { Storage } from "@google-cloud/storage";

// =============================================================================
// Constants
// =============================================================================

const MAX_CONTEXT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per file
const MAX_CONTEXT_FILES_PER_ORG = 20;

// Allowed MIME types for context files
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
];

// =============================================================================
// Types
// =============================================================================

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

// =============================================================================
// Validation Schemas
// =============================================================================

const UploadContextSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().refine((mt) => ALLOWED_MIME_TYPES.includes(mt), {
    message:
      "Invalid file type. Allowed: PDF, Word, Excel, text, markdown, CSV, JSON",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_CONTEXT_SIZE_BYTES, {
      message: `File size must not exceed ${MAX_CONTEXT_SIZE_BYTES / (1024 * 1024)}MB`,
    }),
  agentIds: z.array(z.string()).optional().default([]),
});

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
 * Sanitize filename for GCS path
 */
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/\.\./g, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim();
}

/**
 * Get GCS storage client
 */
function getStorage(): Storage {
  return new Storage();
}

/**
 * Generate signed URL for upload
 */
async function generateSignedUploadUrl(
  gcsPath: string,
  mimeType: string,
): Promise<{ url: string; expiresAt: Date }> {
  const storage = getStorage();
  const bucket = storage.bucket(
    process.env.GCS_BUCKET_NAME || "expert-ai-uploads",
  );

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const [url] = await bucket.file(gcsPath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType: mimeType,
  });

  return { url, expiresAt };
}

// =============================================================================
// POST /api/org/:orgId/context - Request upload URL for context file
// =============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
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
          message: "Only owners and admins can upload context files",
        },
        { status: 403 },
      );
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validation = UploadContextSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid request body",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { filename, mimeType, sizeBytes, agentIds } = validation.data;

    // 4. Check context file count limit
    const existingCount = await prisma.contextFile.count({
      where: { orgId },
    });

    if (existingCount >= MAX_CONTEXT_FILES_PER_ORG) {
      return NextResponse.json(
        {
          error: "Limit Exceeded",
          message: `Maximum ${MAX_CONTEXT_FILES_PER_ORG} context files per organization`,
        },
        { status: 400 },
      );
    }

    // 5. Generate GCS path
    const sanitizedFilename = sanitizeFilename(filename);
    const timestamp = Date.now();
    const gcsPath = `orgs/${orgId}/context/${timestamp}_${sanitizedFilename}`;

    // 6. Generate signed upload URL
    const { url: uploadUrl, expiresAt } = await generateSignedUploadUrl(
      gcsPath,
      mimeType,
    );

    // 7. Create pending ContextFile record
    const contextFile = await prisma.contextFile.create({
      data: {
        orgId,
        name: sanitizedFilename,
        gcsPath,
        mimeType,
        sizeBytes,
        agentIds,
        uploadedById: session.user.id,
      },
    });

    // 8. Return upload URL and file info
    return NextResponse.json({
      uploadUrl,
      gcsPath,
      fileId: contextFile.id,
      expiresAt: expiresAt.toISOString(),
      file: {
        id: contextFile.id,
        name: contextFile.name,
        mimeType: contextFile.mimeType,
        sizeBytes: contextFile.sizeBytes,
        agentIds: contextFile.agentIds,
      },
    });
  } catch (error) {
    console.error("Error creating context file:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to create context file",
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// GET /api/org/:orgId/context - List context files
// =============================================================================

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
        { error: "Forbidden", message: "Not a member of this organization" },
        { status: 403 },
      );
    }

    // 3. Fetch context files
    const contextFiles = await prisma.contextFile.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        mimeType: true,
        sizeBytes: true,
        agentIds: true,
        createdAt: true,
        uploadedById: true,
      },
    });

    // 4. Get limit info
    const remaining = MAX_CONTEXT_FILES_PER_ORG - contextFiles.length;

    return NextResponse.json({
      files: contextFiles,
      count: contextFiles.length,
      limit: MAX_CONTEXT_FILES_PER_ORG,
      remaining,
    });
  } catch (error) {
    console.error("Error listing context files:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to list context files",
      },
      { status: 500 },
    );
  }
}
