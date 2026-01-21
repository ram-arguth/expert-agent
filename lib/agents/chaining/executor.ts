/**
 * Chain Executor
 *
 * Handles the execution of multi-agent chains, including:
 * - Validation of chain paths
 * - Execution of individual agents
 * - Transformation of data between agents (via Mappers)
 * - Persistence of intermediate results to the database
 *
 * @see docs/DESIGN.md - Multi-Agent Chaining
 */

import { prisma } from "@/lib/db/client";
import {
  ChainExecutionRequest,
  ChainExecutionResult,
  ChainStepResult,
  ChainValidationResult,
} from "./types";
import { mapperRegistry } from "./mapper-registry";

// Mock simulation function (replace with real Vertex AI calls in future)
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
        jurisdiction: (input.jurisdiction as string) || "US",
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
        analysisType: (input.analysisType as string) || "general",
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

export class ChainExecutor {
  /**
   * meaningful ID generator
   */
  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate a chain request
   */
  public validateChain(agentIds: string[]): ChainValidationResult {
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
   * Execute a chain of agents
   */
  public async execute(
    request: ChainExecutionRequest,
    userId: string,
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now();
    const chainId = this.generateChainId();
    const { input, agentChain, stopOnError, sessionId, orgId } = request;

    // Validate first (double check, though caller should usually check)
    const validation = this.validateChain(agentChain);
    if (!validation.valid) {
      throw new Error(
        `Invalid chain: ${validation.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // Ensure session exists if we are persisting
    let targetSessionId = sessionId;
    if (!targetSessionId && userId) {
      // Create a new session for this chain
      const session = await prisma.session.create({
        data: {
          userId,
          orgId: orgId,
          agentId: agentChain[0], // Attribute to the first agent? Or a "Router"?
          // For chains, we probably want to track the primary agent.
        },
      });
      targetSessionId = session.id;
    }

    const steps: ChainStepResult[] = [];
    let currentInput = input;
    const totalTokens = { input: 0, output: 0, total: 0 };

    // Record User Input as a message if desired?
    // Logic: We assume the caller might have already recorded the initial user query.
    // But if we are running an autonomous chain, maybe we record the initial input.
    if (targetSessionId) {
      await prisma.message.create({
        data: {
          sessionId: targetSessionId,
          role: "USER",
          content: JSON.stringify(input, null, 2), // Should be Markdown rendered ideally
          jsonData: input as any, // Store raw input
        },
      });
    }

    for (let i = 0; i < agentChain.length; i++) {
      const stepAgentId = agentChain[i];
      const stepStartTime = Date.now();

      try {
        // Execute agent
        const stepOutput = await simulateAgentExecution(
          stepAgentId,
          currentInput,
        );

        const stepDuration = Date.now() - stepStartTime;
        const stepTokens = { input: 500, output: 300, total: 800 }; // Mock

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

        // Persist intermediate result
        if (targetSessionId) {
          await prisma.message.create({
            data: {
              sessionId: targetSessionId,
              role: "AGENT",
              content: `**Input from ${stepAgentId}**: \n\n\`\`\`json\n${JSON.stringify(stepOutput, null, 2)}\n\`\`\``, // Placeholder renderer
              jsonData: stepOutput as any,
              inputTokens: stepTokens.input,
              outputTokens: stepTokens.output,
            },
          });
        }

        // Map for next agent
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
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        steps.push({
          agentId: stepAgentId,
          success: false,
          error: errorMessage,
          durationMs: stepDuration,
        });

        // Persist error
        if (targetSessionId) {
          await prisma.message.create({
            data: {
              sessionId: targetSessionId,
              role: "SYSTEM",
              content: `Error in chain step execution (${stepAgentId}): ${errorMessage}`,
            },
          });
        }

        if (stopOnError) {
          break;
        }
      }
    }

    const allSuccess = steps.every((s) => s.success);
    const lastSuccessfulStep = [...steps].reverse().find((s) => s.success);

    return {
      chainId,
      success: allSuccess,
      steps,
      finalOutput: lastSuccessfulStep?.output,
      totalDurationMs: Date.now() - startTime,
      totalTokenUsage: totalTokens,
      sessionId: targetSessionId,
    };
  }
}

export const chainExecutor = new ChainExecutor();
