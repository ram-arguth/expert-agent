/**
 * Agent Mapper Registry
 *
 * Registry of mapper functions that transform output from one agent
 * into input for another agent, enabling multi-agent chaining.
 *
 * @see docs/DESIGN.md - Multi-Agent Chaining section
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

import type { AgentMapper, MapperRegistry } from "./types";

// =============================================================================
// Mapper Definitions
// =============================================================================

/**
 * UX Analyst → Legal Advisor
 * Maps UX findings to legal review scope
 */
const uxToLegalMapper: AgentMapper = {
  id: "ux-to-legal",
  sourceAgentId: "ux-analyst",
  targetAgentId: "legal-advisor",
  description:
    "Review UX findings for legal compliance (accessibility, privacy, consumer protection)",
  isLossy: true,
  map: (input: Record<string, unknown>) => {
    const findings = (input.findings as Array<Record<string, unknown>>) || [];
    const accessibilityFindings = findings.filter(
      (f) => f.category === "accessibility" || f.category === "compliance",
    );

    return {
      documentType: "UX Analysis Report",
      jurisdiction: "US", // Default, can be overridden
      focusAreas: ["accessibility", "privacy", "consumer_protection"],
      context: `Review the following UX findings for legal compliance:\n${accessibilityFindings
        .map((f) => `- [${f.severity}] ${f.title}: ${f.description}`)
        .join("\n")}`,
      originalAnalysis: {
        findings: accessibilityFindings,
        summary: input.summary,
      },
    };
  },
};

/**
 * UX Analyst → Finance Planner
 * Maps UX recommendations to ROI/budget analysis
 */
const uxToFinanceMapper: AgentMapper = {
  id: "ux-to-finance",
  sourceAgentId: "ux-analyst",
  targetAgentId: "finance-planner",
  description: "Analyze ROI and budget implications of UX recommendations",
  isLossy: true,
  map: (input: Record<string, unknown>) => {
    const recommendations =
      (input.recommendations as Array<Record<string, unknown>>) || [];

    // Group by effort/impact for prioritization
    const initiatives = recommendations.map((r) => ({
      name: r.title as string,
      description: r.description as string,
      effort: r.effort as string,
      impact: r.impact as string,
      category: "UX Improvement",
    }));

    return {
      analysisType: "project_budget",
      context: "UX improvement initiatives from UX analysis",
      initiatives,
      constraints: {
        timeline: "quarterly",
        budgetCeiling: null,
      },
      originalAnalysis: {
        recommendations,
        scores: input.scores,
      },
    };
  },
};

/**
 * Legal Advisor → Finance Planner
 * Maps legal findings to risk/cost analysis
 */
const legalToFinanceMapper: AgentMapper = {
  id: "legal-to-finance",
  sourceAgentId: "legal-advisor",
  targetAgentId: "finance-planner",
  description:
    "Analyze financial implications and risk exposure from legal findings",
  isLossy: true,
  map: (input: Record<string, unknown>) => {
    const findings = (input.findings as Array<Record<string, unknown>>) || [];
    const recommendations =
      (input.recommendations as Array<Record<string, unknown>>) || [];

    // Calculate risk exposure based on severity
    const riskItems = findings.map((f) => ({
      name: f.title as string,
      description: f.description as string,
      severity: f.severity as string,
      category: "Legal Risk",
      estimatedExposure:
        f.severity === "critical"
          ? "high"
          : f.severity === "high"
            ? "medium"
            : "low",
    }));

    return {
      analysisType: "risk_assessment",
      context: "Legal compliance risk analysis",
      riskItems,
      mitigationActions: recommendations.map((r) => ({
        name: r.title as string,
        description: r.description as string,
        urgency: r.priority as string,
      })),
      originalAnalysis: {
        findings,
        summary: input.summary,
      },
    };
  },
};

/**
 * Finance Planner → Legal Advisor
 * Maps financial projections for legal review
 */
const financeToLegalMapper: AgentMapper = {
  id: "finance-to-legal",
  sourceAgentId: "finance-planner",
  targetAgentId: "legal-advisor",
  description: "Review financial projections for regulatory compliance",
  isLossy: true,
  map: (input: Record<string, unknown>) => {
    const projections = input.projections || input.budget || {};

    return {
      documentType: "Financial Projection",
      jurisdiction: "US",
      focusAreas: [
        "financial_regulations",
        "disclosure_requirements",
        "tax_compliance",
      ],
      context: `Review financial projections for regulatory compliance:\n${JSON.stringify(projections, null, 2)}`,
      originalAnalysis: input,
    };
  },
};

// =============================================================================
// Mapper Registry Implementation
// =============================================================================

/**
 * All registered mappers
 */
const mappers: AgentMapper[] = [
  uxToLegalMapper,
  uxToFinanceMapper,
  legalToFinanceMapper,
  financeToLegalMapper,
];

/**
 * Index mappers by ID
 */
const mapperById = new Map<string, AgentMapper>(mappers.map((m) => [m.id, m]));

/**
 * Index mappers by source-target pair
 */
const mapperByPair = new Map<string, AgentMapper>(
  mappers.map((m) => [`${m.sourceAgentId}->${m.targetAgentId}`, m]),
);

/**
 * Create the mapper registry
 */
export function createMapperRegistry(): MapperRegistry {
  return {
    get(mapperId: string): AgentMapper | undefined {
      return mapperById.get(mapperId);
    },

    getForAgents(
      sourceAgentId: string,
      targetAgentId: string,
    ): AgentMapper | undefined {
      return mapperByPair.get(`${sourceAgentId}->${targetAgentId}`);
    },

    list(): AgentMapper[] {
      return [...mappers];
    },

    isValidChain(agentIds: string[]): boolean {
      if (agentIds.length < 2) return false;

      for (let i = 0; i < agentIds.length - 1; i++) {
        const sourceId = agentIds[i];
        const targetId = agentIds[i + 1];
        if (!mapperByPair.has(`${sourceId}->${targetId}`)) {
          return false;
        }
      }

      return true;
    },
  };
}

/**
 * Default mapper registry instance
 */
export const mapperRegistry = createMapperRegistry();

/**
 * Get all chainable paths from a given agent
 */
export function getChainTargets(agentId: string): AgentMapper[] {
  return mappers.filter((m) => m.sourceAgentId === agentId);
}

/**
 * Get all agents that can chain to a given agent
 */
export function getChainSources(agentId: string): AgentMapper[] {
  return mappers.filter((m) => m.targetAgentId === agentId);
}
