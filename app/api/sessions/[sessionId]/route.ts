/**
 * Session Detail API - Get Single Session
 *
 * GET /api/sessions/[sessionId] - Get full session with message history
 *
 * @see docs/DESIGN.md - Session Management section
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getCedarEngine, CedarActions } from '@/lib/authz/cedar';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/sessions/[sessionId]
 *
 * Returns full session details with message history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // 1. Validate sessionId format
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid Session ID', message: 'Session ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 3. Fetch session (include user check in query for efficiency)
    const agentSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id, // Ensures ownership
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            jsonData: true,
            inputTokens: true,
            outputTokens: true,
            createdAt: true,
          },
        },
      },
    });

    if (!agentSession) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Session not found' },
        { status: 404 }
      );
    }

    // 4. Authorize - Cedar check for reading sessions
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.GetSession },
      resource: {
        type: 'Session',
        id: sessionId,
        attributes: {
          userId: agentSession.userId,
        },
      },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized to view this session' },
        { status: 403 }
      );
    }

    // 5. Calculate token usage
    const totalTokens = agentSession.messages.reduce(
      (acc, msg) => ({
        input: acc.input + (msg.inputTokens || 0),
        output: acc.output + (msg.outputTokens || 0),
      }),
      { input: 0, output: 0 }
    );

    // 6. Format response
    const response = {
      id: agentSession.id,
      agentId: agentSession.agentId,
      agentName: getAgentDisplayName(agentSession.agentId),
      createdAt: agentSession.createdAt.toISOString(),
      updatedAt: agentSession.updatedAt.toISOString(),
      archived: agentSession.archived,
      summaryUrl: agentSession.summaryUrl,
      messages: agentSession.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        structuredData: msg.jsonData,
        tokens: {
          input: msg.inputTokens || 0,
          output: msg.outputTokens || 0,
        },
        createdAt: msg.createdAt.toISOString(),
      })),
      usage: {
        totalInputTokens: totalTokens.input,
        totalOutputTokens: totalTokens.output,
        totalTokens: totalTokens.input + totalTokens.output,
      },
      messageCount: agentSession.messages.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[sessionId]
 *
 * Deletes a session (soft delete - marks as archived)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // 1. Validate sessionId format
    if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid Session ID', message: 'Session ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // 2. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 3. Check session exists and belongs to user
    const agentSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    });

    if (!agentSession) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Session not found' },
        { status: 404 }
      );
    }

    // 4. Authorize - Cedar check for deleting sessions
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: { type: 'User', id: session.user.id },
      action: { type: 'Action', id: CedarActions.DeleteSession },
      resource: {
        type: 'Session',
        id: sessionId,
        attributes: {
          userId: agentSession.userId,
        },
      },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized to delete this session' },
        { status: 403 }
      );
    }

    // 5. Soft delete (mark as archived)
    await prisma.session.update({
      where: { id: sessionId },
      data: { archived: true },
    });

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete session' },
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
