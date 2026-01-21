/**
 * Multi-Agent Chain API
 *
 * POST /api/agents/:agentId/chain - Execute a multi-agent chain
 * GET /api/agents/:agentId/chain - Get chainable targets for an agent
 *
 * @see docs/DESIGN.md - Multi-Agent Chaining section
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCedarEngine, CedarActions } from "@/lib/authz/cedar";
import { ChainExecutionRequestSchema } from "@/lib/agents/chaining/types";
import { getChainTargets } from "@/lib/agents/chaining/mapper-registry";
import { chainExecutor } from "@/lib/agents/chaining/executor";

// =============================================================================
// Types
// =============================================================================

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

// =============================================================================
// GET /api/agents/:agentId/chain - Get chainable targets
// =============================================================================

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;

    // Auth optional - public endpoint for chain discovery
    const session = await auth();

    // Get chain targets for this agent
    const targets = getChainTargets(agentId);

    return NextResponse.json({
      agentId,
      chainable: targets.length > 0,
      targets: targets.map((t) => ({
        targetAgentId: t.targetAgentId,
        mapperId: t.id,
        description: t.description,
        isLossy: t.isLossy ?? false,
      })),
      authenticated: !!session?.user,
    });
  } catch (error) {
    console.error("Error getting chain targets:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to get chain targets",
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// POST /api/agents/:agentId/chain - Execute multi-agent chain
// =============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;

    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 },
      );
    }

    // 2. Authorize via Cedar
    const cedar = getCedarEngine();
    const decision = cedar.isAuthorized({
      principal: {
        type: "User",
        id: session.user.id,
        attributes: { roles: {} },
      },
      action: { type: "Action", id: CedarActions.QueryAgent },
      resource: { type: "Agent", id: agentId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden", message: "Not authorized to execute this chain" },
        { status: 403 },
      );
    }

    // 3. Parse and validate request
    const body = await request.json();

    // Ensure agentChain starts with (or implies) the agentId from URL
    const parseResult = ChainExecutionRequestSchema.safeParse({
      ...body,
      agentChain: [
        agentId,
        ...(body.agentChain?.slice(1) || body.targetAgents || []),
      ],
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Invalid chain request",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const requestPayload = parseResult.data;

    // Verify consistency
    if (requestPayload.agentChain[0] !== agentId) {
      return NextResponse.json(
        {
          error: "Invalid Chain",
          message: "Chain must start with the agent from URL",
        },
        { status: 400 },
      );
    }

    // 4. Execute chain using ChainExecutor
    const result = await chainExecutor.execute(requestPayload, session.user.id);

    // 5. Log chain execution for audit
    console.log({
      event: "chain_execution",
      chainId: result.chainId,
      userId: session.user.id,
      agentChain: requestPayload.agentChain,
      success: result.success,
      durationMs: result.totalDurationMs,
      totalTokens: result.totalTokenUsage.total,
      sessionId: result.sessionId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error executing chain:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    // Handle validation errors thrown by executor
    if (message.startsWith("Invalid chain")) {
      return NextResponse.json(
        { error: "Invalid Chain", message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to execute chain",
      },
      { status: 500 },
    );
  }
}
