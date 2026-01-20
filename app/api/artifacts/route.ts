/**
 * Artifacts API - List User Artifacts
 *
 * GET /api/artifacts - List all artifacts for the authenticated user
 *
 * Query params:
 * - filter: 'all' | 'favorites' | 'recent' | 'shared' (default: 'all')
 * - agentId: Filter by agent type
 * - limit: Max results (default 20, max 100)
 * - cursor: Pagination cursor (artifact ID)
 *
 * Artifacts are derived from Sessions with agent responses.
 * Each session's last agent message is treated as the artifact.
 *
 * @see docs/DESIGN.md - Artifact Management section
 * @see docs/IMPEMENTATION.md - Phase 4.7
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";

// Query params schema
const ListArtifactsQuerySchema = z.object({
  filter: z.enum(["all", "favorites", "recent", "shared"]).default("all"),
  agentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

// Response artifact type
interface ArtifactResponse {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isShared: boolean;
  sharedBy?: string;
  preview?: string;
}

/**
 * GET /api/artifacts
 *
 * Returns a paginated list of user's artifacts with:
 * - Artifact metadata (id, title, agentId, dates)
 * - Favorite status
 * - Share status
 * - Preview text
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Authorize - user can list their own artifacts
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: "User", id: session.user.id },
      action: { type: "Action", id: CedarActions.ListArtifacts },
      resource: { type: "User", id: session.user.id },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden", message: "Not authorized to list artifacts" },
        { status: 403 },
      );
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = ListArtifactsQuerySchema.safeParse({
      filter: searchParams.get("filter") || "all",
      agentId: searchParams.get("agentId") || undefined,
      limit: searchParams.get("limit") || 20,
      cursor: searchParams.get("cursor") || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid query parameters",
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { filter, agentId, limit, cursor } = queryResult.data;

    // 4. Build query based on filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      userId: session.user.id,
      archived: false, // Only non-archived sessions
      messages: {
        some: {
          role: "AGENT", // Must have at least one agent response
        },
      },
    };

    if (agentId) {
      whereClause.agentId = agentId;
    }

    if (cursor) {
      whereClause.id = { lt: cursor };
    }

    // Apply filter-specific logic
    // Note: favorites and shared filters will work once schema is updated
    // For now, filter logic is prepared but returns all for unimplemented filters
    let orderBy: { updatedAt?: "desc"; createdAt?: "desc" } = {
      updatedAt: "desc",
    };

    if (filter === "recent") {
      // Sort by most recent
      orderBy = { updatedAt: "desc" };
    }
    // favorites and shared filters would require schema changes
    // Placeholder logic returns empty for now
    if (filter === "favorites") {
      // When isFavorite field is added:
      // whereClause.isFavorite = true;
      // For now, return empty array to indicate no favorites
      return NextResponse.json({
        artifacts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          count: 0,
        },
        filter,
        message: "Favorites feature requires database migration. Coming soon.",
      });
    }

    if (filter === "shared") {
      // When sharing is implemented:
      // whereClause.OR = [{ sharedWithUserId: session.user.id }];
      // For now, return empty array
      return NextResponse.json({
        artifacts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          count: 0,
        },
        filter,
        message:
          "Shared artifacts feature requires database migration. Coming soon.",
      });
    }

    // 5. Fetch sessions that have agent responses
    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy,
      take: limit + 1, // Fetch one extra to check if there's more
      include: {
        messages: {
          where: { role: "AGENT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            jsonData: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // 6. Check if there's more
    const hasMore = sessions.length > limit;
    const results = hasMore ? sessions.slice(0, limit) : sessions;

    // 7. Format as artifacts
    const artifacts: ArtifactResponse[] = results
      .filter((s) => s.messages.length > 0) // Must have agent response
      .map((s) => {
        const lastAgentMessage = s.messages[0];
        const jsonData = lastAgentMessage.jsonData as Record<
          string,
          unknown
        > | null;

        // Extract title from JSON data or use agent name
        const title =
          (jsonData?.title as string) ||
          (jsonData?.summary as string) ||
          `${getAgentDisplayName(s.agentId)} Analysis`;

        // Extract preview from content
        const preview = truncateMessage(lastAgentMessage.content, 150);

        return {
          id: s.id,
          title,
          agentId: s.agentId,
          agentName: getAgentDisplayName(s.agentId),
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          isFavorite: false, // Will be populated when schema is updated
          isShared: false, // Will be populated when sharing is implemented
          preview,
        };
      });

    return NextResponse.json({
      artifacts,
      pagination: {
        hasMore,
        nextCursor:
          hasMore && results.length > 0 ? results[results.length - 1].id : null,
        count: artifacts.length,
      },
      filter,
    });
  } catch (error) {
    console.error("Error listing artifacts:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to list artifacts" },
      { status: 500 },
    );
  }
}

/**
 * Get display name for an agent
 */
function getAgentDisplayName(agentId: string): string {
  const agentNames: Record<string, string> = {
    "ux-analyst": "UX Analyst",
    "legal-advisor": "Legal Advisor",
    "finance-planner": "Finance Planner",
    "security-analyst": "Security Analyst",
    "data-analyst": "Data Analyst",
    "code-reviewer": "Code Reviewer",
  };
  return agentNames[agentId] || agentId;
}

/**
 * Truncate message for preview
 */
function truncateMessage(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength - 3) + "...";
}
