/**
 * Agent API - Get Agent Details & Schema
 *
 * GET /api/agents/[agentId] - Get agent details including input schema
 *
 * Cedar Action: GetAgent
 *
 * @see docs/DESIGN.md - Agent Catalog section
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAuthorized, buildPrincipalFromSession, CedarActions } from '@/lib/authz/cedar';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Import agent configurations
import {
  UX_ANALYST_CONFIG,
  UxAnalystInputSchema,
  UxAnalystFormConfig,
} from '@/lib/agents/ux-analyst';

// Agent registry with schemas
const AGENT_REGISTRY: Record<
  string,
  {
    config: typeof UX_ANALYST_CONFIG;
    inputSchema: typeof UxAnalystInputSchema;
    formConfig: typeof UxAnalystFormConfig;
    allowedOrgIds?: string[];
  }
> = {
  'ux-analyst': {
    config: UX_ANALYST_CONFIG,
    inputSchema: UxAnalystInputSchema,
    formConfig: UxAnalystFormConfig,
  },
  // Add more agents here
};

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const session = await auth();

    // Check if agent exists
    const agent = AGENT_REGISTRY[agentId];
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get user's memberships for authorization
    let memberships: { orgId: string; role: string }[] = [];
    if (session?.user?.id) {
      memberships = await prisma.membership.findMany({
        where: { userId: session.user.id },
        select: { orgId: true, role: true },
      });
    }

    const principal = buildPrincipalFromSession(session, memberships);

    // Check authorization
    const resource = {
      type: 'Agent' as const,
      id: agentId,
      attributes: {
        isPublic: agent.config.isPublic,
        isBeta: agent.config.isBeta,
        allowedOrgIds: agent.allowedOrgIds || [],
      },
    };

    const decision = isAuthorized({
      principal,
      action: { type: 'Action', id: CedarActions.GetAgent },
      resource,
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied', reason: decision.reason },
        { status: 403 }
      );
    }

    // Generate JSON Schema from Zod schema for form rendering
    const jsonSchema = zodToJsonSchema(agent.inputSchema, {
      name: `${agentId}Input`,
      $refStrategy: 'none',
    });

    return NextResponse.json({
      agent: {
        id: agent.config.id,
        displayName: agent.config.displayName,
        description: agent.config.description,
        category: agent.config.category,
        iconUrl: agent.config.iconUrl,
        isBeta: agent.config.isBeta,
        supportsGuidedInterview: agent.config.supportsGuidedInterview,
        supportsFileUpload: agent.config.supportsFileUpload,
        supportsStreaming: agent.config.supportsStreaming,
      },
      inputSchema: jsonSchema,
      formConfig: agent.formConfig,
    });
  } catch (error) {
    console.error('Error getting agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
