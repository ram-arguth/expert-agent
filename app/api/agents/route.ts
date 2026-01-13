/**
 * Agent Catalog API - List Agents
 *
 * GET /api/agents - List available agents for the current user
 *
 * Cedar Action: ListAgents
 * Returns only agents the user has access to based on:
 * - Public agents (isPublic: true)
 * - Beta agents if user's org is in allowedOrgIds
 *
 * @see docs/DESIGN.md - Agent Catalog section
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAuthorized, buildPrincipalFromSession, CedarActions } from '@/lib/authz/cedar';

// Agent catalog (in-memory for now, can move to DB)
import { UX_ANALYST_CONFIG } from '@/lib/agents/ux-analyst';

// Static agent definitions
const AGENT_CATALOG = [
  UX_ANALYST_CONFIG,
  // Add more agents here as they're developed
  {
    id: 'legal-advisor',
    displayName: 'Legal Advisor',
    description: 'Contract analysis and legal document review with actionable insights.',
    category: 'legal',
    iconUrl: '/icons/agents/legal-advisor.svg',
    isBeta: true,
    isPublic: false,
    allowedOrgIds: [], // Will be populated from DB
    supportsGuidedInterview: true,
    supportsFileUpload: true,
    supportsStreaming: true,
  },
  {
    id: 'finance-planner',
    displayName: 'Finance Planner',
    description: 'Financial analysis, budgeting, and investment recommendations.',
    category: 'finance',
    iconUrl: '/icons/agents/finance-planner.svg',
    isBeta: true,
    isPublic: false,
    allowedOrgIds: [],
    supportsGuidedInterview: true,
    supportsFileUpload: true,
    supportsStreaming: true,
  },
];

export async function GET() {
  try {
    const session = await auth();

    // Get user's memberships for filtering
    let memberships: { orgId: string; role: string }[] = [];
    if (session?.user?.id) {
      memberships = await prisma.membership.findMany({
        where: { userId: session.user.id },
        select: { orgId: true, role: true },
      });
    }

    const principal = buildPrincipalFromSession(session, memberships);

    // Filter agents based on access
    const accessibleAgents = AGENT_CATALOG.filter((agent) => {
      // Build a resource for authorization check
      const resource = {
        type: 'Agent' as const,
        id: agent.id,
        attributes: {
          isPublic: agent.isPublic,
          isBeta: agent.isBeta,
          allowedOrgIds: (agent as { allowedOrgIds?: string[] }).allowedOrgIds || [],
        },
      };

      const decision = isAuthorized({
        principal,
        action: { type: 'Action', id: CedarActions.ListAgents },
        resource,
      });

      return decision.isAuthorized;
    });

    // Return filtered agents with metadata
    return NextResponse.json({
      agents: accessibleAgents.map((agent) => ({
        id: agent.id,
        displayName: agent.displayName,
        description: agent.description,
        category: agent.category,
        iconUrl: agent.iconUrl,
        isBeta: agent.isBeta,
        supportsGuidedInterview: agent.supportsGuidedInterview,
        supportsFileUpload: agent.supportsFileUpload,
        supportsStreaming: agent.supportsStreaming,
      })),
      total: accessibleAgents.length,
    });
  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
