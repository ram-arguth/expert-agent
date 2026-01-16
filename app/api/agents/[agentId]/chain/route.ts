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
import {
  ChainExecutionRequestSchema,
  type ChainExecutionResult,
  type ChainStepResult,
  type ChainValidationResult,
} from "@/lib/agents/chaining/types";
import {
  mapperRegistry,
  getChainTargets,
} from "@/lib/agents/chaining/mapper-registry";

// =============================================================================
// Types
// =============================================================================

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validate a chain request
 */
function validateChain(agentIds: string[]): ChainValidationResult {
  const errors: ChainValidationResult["errors"] = [];
  const warnings: string[] = [];

  if (agentIds.length < 2) {
    errors.push({
      stepIndex: 0,
      sourceAgentId: agentIds[0] || "unknown",
      targetAgentId: "unknown",
      message: "Chain must have at least 2 agents",
    });
    return { valid: false, errors, warnings };
  }

  // Check each pair has a valid mapper
  for (let i = 0; i < agentIds.length - 1; i++) {
    const sourceId = agentIds[i];
    const targetId = agentIds[i + 1];
    const mapper = mapperRegistry.getForAgents(sourceId, targetId);

    if (!mapper) {
      errors.push({
        stepIndex: i,
        sourceAgentId: sourceId,
        targetAgentId: targetId,
        message: `No mapper exists for ${sourceId} → ${targetId}`,
      });
    } else if (mapper.isLossy) {
      warnings.push(
        `Step ${i + 1}: ${sourceId} → ${targetId} mapping may lose some data`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate unique chain ID
 */
function generateChainId(): string {
  return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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
  const startTime = Date.now();
  const chainId = generateChainId();

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

    const { input, agentChain, stopOnError } = parseResult.data;

    // 4. Validate chain path
    const validation = validateChain(agentChain);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Invalid Chain",
          message: "The requested agent chain is not valid",
          chainId,
          validation,
        },
        { status: 400 },
      );
    }

    // 5. Execute chain (mocked for now - actual AI calls would go here)
    const steps: ChainStepResult[] = [];
    let currentInput = input;
    const totalTokens = { input: 0, output: 0, total: 0 };

    for (let i = 0; i < agentChain.length; i++) {
      const stepAgentId = agentChain[i];
      const stepStartTime = Date.now();

      try {
        // Simulate agent execution (replace with actual Vertex AI call)
        const stepOutput = await simulateAgentExecution(
          stepAgentId,
          currentInput,
        );

        const stepDuration = Date.now() - stepStartTime;
        const stepTokens = { input: 500, output: 300, total: 800 }; // Mock token usage

        steps.push({
          agentId: stepAgentId,
          success: true,
          output: stepOutput,
          durationMs: stepDuration,
          tokenUsage: stepTokens,
        });

        totalTokens.input += stepTokens.input;
        totalTokens.output += stepTokens.output;
        totalTokens.total += stepTokens.total;

        // Transform output for next agent if not the last step
        if (i < agentChain.length - 1) {
          const nextAgentId = agentChain[i + 1];
          const mapper = mapperRegistry.getForAgents(stepAgentId, nextAgentId);
          if (mapper) {
            currentInput = mapper.map(stepOutput) as Record<string, unknown>;
          }
        } else {
          currentInput = stepOutput;
        }
      } catch (error) {
        const stepDuration = Date.now() - stepStartTime;

        steps.push({
          agentId: stepAgentId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: stepDuration,
        });

        if (stopOnError) {
          break;
        }
      }
    }

    // 6. Build result
    const allSuccess = steps.every((s) => s.success);
    const lastSuccessfulStep = [...steps].reverse().find((s) => s.success);

    const result: ChainExecutionResult = {
      chainId,
      success: allSuccess,
      steps,
      finalOutput: lastSuccessfulStep?.output,
      totalDurationMs: Date.now() - startTime,
      totalTokenUsage: totalTokens,
    };

    // 7. Log chain execution for audit
    console.log({
      event: "chain_execution",
      chainId,
      userId: session.user.id,
      agentChain,
      success: allSuccess,
      durationMs: result.totalDurationMs,
      totalTokens: totalTokens.total,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error executing chain:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to execute chain",
        chainId,
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// Mock Agent Execution (to be replaced with actual Vertex AI calls)
// =============================================================================

async function simulateAgentExecution(
  agentId: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Return mock output based on agent type
  switch (agentId) {
    case "ux-analyst":
      return {
        summary: "UX analysis complete",
        scores: { usability: 75, accessibility: 82, aesthetics: 70 },
        findings: [
          {
            id: "f1",
            title: "Missing alt text",
            description: "Some images lack alternative text",
            severity: "high",
            category: "accessibility",
          },
        ],
        recommendations: [
          {
            id: "r1",
            title: "Add alt text to images",
            description: "Ensure all images have descriptive alt text",
            priority: "high",
            effort: "low",
            impact: "high",
          },
        ],
      };

    case "legal-advisor":
      return {
        summary: "Legal review complete",
        jurisdiction: input.jurisdiction || "US",
        findings: [
          {
            id: "lf1",
            title: "WCAG Compliance Gap",
            description: "Accessibility issues may violate ADA requirements",
            severity: "high",
            category: "accessibility_compliance",
          },
        ],
        recommendations: [
          {
            id: "lr1",
            title: "Remediate accessibility issues",
            description:
              "Address identified accessibility gaps to ensure ADA compliance",
            priority: "high",
          },
        ],
      };

    case "finance-planner":
      return {
        summary: "Financial analysis complete",
        analysisType: input.analysisType || "general",
        projections: {
          estimatedCost: 15000,
          estimatedROI: 2.5,
          paybackPeriod: "6 months",
        },
        recommendations: [
          {
            id: "fr1",
            title: "Prioritize high-impact fixes",
            description: "Focus on quick wins with high ROI first",
            priority: "high",
          },
        ],
      };

    default:
      return {
        summary: `${agentId} analysis complete`,
        input: input,
        processed: true,
      };
  }
}
