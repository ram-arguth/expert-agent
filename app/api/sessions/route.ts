/**
 * Sessions API - List User Sessions
 *
 * GET /api/sessions - List all sessions for the authenticated user
 *
 * Query params:
 * - agentId: Filter by agent type
 * - limit: Max results (default 20, max 100)
 * - cursor: Pagination cursor (session ID)
 *
 * @see docs/DESIGN.md - Session Management section
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';

// Query params schema
const ListSessionsQuerySchema = z.object({
  agentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

/**
 * GET /api/sessions
 *
 * Returns a paginated list of user's sessions with:
 * - Session metadata (id, agentId, createdAt, updatedAt)
 * - Last message preview
 * - Message count
 * - Agent name
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Authorize - user can list their own sessions
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.ListSessions },
      resource: { type: 'User', id: session.user.id },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized to list sessions' },
        { status: 403 }
      );
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = ListSessionsQuerySchema.safeParse({
      agentId: searchParams.get('agentId') || undefined,
      limit: searchParams.get('limit') || 20,
      cursor: searchParams.get('cursor') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: queryResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { agentId, limit, cursor } = queryResult.data;

    // 4. Build query
    const whereClause: {
      userId: string;
      agentId?: string;
      id?: { lt: string };
    } = {
      userId: session.user.id,
    };

    if (agentId) {
      whereClause.agentId = agentId;
    }

    if (cursor) {
      whereClause.id = { lt: cursor };
    }

    // 5. Fetch sessions with last message
    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1, // Fetch one extra to check if there's more
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
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

    // 7. Format response
    const formattedSessions = results.map((s) => ({
      id: s.id,
      agentId: s.agentId,
      agentName: getAgentDisplayName(s.agentId),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
      lastMessage: s.messages[0]
        ? {
            id: s.messages[0].id,
            role: s.messages[0].role,
            preview: truncateMessage(s.messages[0].content, 150),
            createdAt: s.messages[0].createdAt.toISOString(),
          }
        : null,
      archived: s.archived,
    }));

    return NextResponse.json({
      sessions: formattedSessions,
      pagination: {
        hasMore,
        nextCursor: hasMore && results.length > 0 ? results[results.length - 1].id : null,
        count: results.length,
      },
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

/**
 * Get display name for an agent
 */
function getAgentDisplayName(agentId: string): string {
  const agentNames: Record<string, string> = {
    'ux-analyst': 'UX Analyst',
    'legal-advisor': 'Legal Advisor',
    'finance-planner': 'Finance Planner',
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
  return content.slice(0, maxLength - 3) + '...';
}
