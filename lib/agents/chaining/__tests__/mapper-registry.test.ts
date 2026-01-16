/**
 * Multi-Agent Chaining Tests
 *
 * Comprehensive tests for the agent chaining module.
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapperRegistry,
  createMapperRegistry,
  getChainTargets,
  getChainSources,
} from "../mapper-registry";
import type { AgentMapper } from "../types";

describe("Mapper Registry", () => {
  describe("createMapperRegistry", () => {
    it("creates a new registry instance", () => {
      const registry = createMapperRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.get).toBe("function");
      expect(typeof registry.getForAgents).toBe("function");
      expect(typeof registry.list).toBe("function");
      expect(typeof registry.isValidChain).toBe("function");
    });
  });

  describe("get", () => {
    it("returns mapper by ID", () => {
      const mapper = mapperRegistry.get("ux-to-legal");
      expect(mapper).toBeDefined();
      expect(mapper?.id).toBe("ux-to-legal");
      expect(mapper?.sourceAgentId).toBe("ux-analyst");
      expect(mapper?.targetAgentId).toBe("legal-advisor");
    });

    it("returns undefined for unknown ID", () => {
      const mapper = mapperRegistry.get("unknown-mapper");
      expect(mapper).toBeUndefined();
    });
  });

  describe("getForAgents", () => {
    it("returns mapper for valid source-target pair", () => {
      const mapper = mapperRegistry.getForAgents("ux-analyst", "legal-advisor");
      expect(mapper).toBeDefined();
      expect(mapper?.id).toBe("ux-to-legal");
    });

    it("returns mapper for ux-analyst → finance-planner", () => {
      const mapper = mapperRegistry.getForAgents(
        "ux-analyst",
        "finance-planner",
      );
      expect(mapper).toBeDefined();
      expect(mapper?.id).toBe("ux-to-finance");
    });

    it("returns mapper for legal-advisor → finance-planner", () => {
      const mapper = mapperRegistry.getForAgents(
        "legal-advisor",
        "finance-planner",
      );
      expect(mapper).toBeDefined();
      expect(mapper?.id).toBe("legal-to-finance");
    });

    it("returns mapper for finance-planner → legal-advisor", () => {
      const mapper = mapperRegistry.getForAgents(
        "finance-planner",
        "legal-advisor",
      );
      expect(mapper).toBeDefined();
      expect(mapper?.id).toBe("finance-to-legal");
    });

    it("returns undefined for invalid pair", () => {
      const mapper = mapperRegistry.getForAgents("legal-advisor", "ux-analyst");
      expect(mapper).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all registered mappers", () => {
      const mappers = mapperRegistry.list();
      expect(Array.isArray(mappers)).toBe(true);
      expect(mappers.length).toBeGreaterThanOrEqual(4);
    });

    it("each mapper has required properties", () => {
      const mappers = mapperRegistry.list();
      for (const mapper of mappers) {
        expect(mapper.id).toBeDefined();
        expect(mapper.sourceAgentId).toBeDefined();
        expect(mapper.targetAgentId).toBeDefined();
        expect(mapper.description).toBeDefined();
        expect(typeof mapper.map).toBe("function");
      }
    });
  });

  describe("isValidChain", () => {
    it("returns true for valid 2-agent chain", () => {
      expect(mapperRegistry.isValidChain(["ux-analyst", "legal-advisor"])).toBe(
        true,
      );
    });

    it("returns true for valid 3-agent chain", () => {
      expect(
        mapperRegistry.isValidChain([
          "ux-analyst",
          "legal-advisor",
          "finance-planner",
        ]),
      ).toBe(true);
    });

    it("returns false for chain with less than 2 agents", () => {
      expect(mapperRegistry.isValidChain(["ux-analyst"])).toBe(false);
      expect(mapperRegistry.isValidChain([])).toBe(false);
    });

    it("returns false for invalid chain pair", () => {
      expect(mapperRegistry.isValidChain(["legal-advisor", "ux-analyst"])).toBe(
        false,
      );
    });

    it("returns false if any step is invalid", () => {
      // ux->legal is valid, but legal->ux is not
      expect(
        mapperRegistry.isValidChain([
          "ux-analyst",
          "legal-advisor",
          "ux-analyst",
        ]),
      ).toBe(false);
    });
  });
});

describe("getChainTargets", () => {
  it("returns targets for ux-analyst", () => {
    const targets = getChainTargets("ux-analyst");
    expect(targets.length).toBeGreaterThanOrEqual(2);
    expect(targets.some((t) => t.targetAgentId === "legal-advisor")).toBe(true);
    expect(targets.some((t) => t.targetAgentId === "finance-planner")).toBe(
      true,
    );
  });

  it("returns targets for legal-advisor", () => {
    const targets = getChainTargets("legal-advisor");
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets.some((t) => t.targetAgentId === "finance-planner")).toBe(
      true,
    );
  });

  it("returns targets for finance-planner", () => {
    const targets = getChainTargets("finance-planner");
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets.some((t) => t.targetAgentId === "legal-advisor")).toBe(true);
  });

  it("returns empty array for unknown agent", () => {
    const targets = getChainTargets("unknown-agent");
    expect(targets).toEqual([]);
  });
});

describe("getChainSources", () => {
  it("returns sources for legal-advisor", () => {
    const sources = getChainSources("legal-advisor");
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.some((s) => s.sourceAgentId === "ux-analyst")).toBe(true);
    expect(sources.some((s) => s.sourceAgentId === "finance-planner")).toBe(
      true,
    );
  });

  it("returns sources for finance-planner", () => {
    const sources = getChainSources("finance-planner");
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.some((s) => s.sourceAgentId === "ux-analyst")).toBe(true);
    expect(sources.some((s) => s.sourceAgentId === "legal-advisor")).toBe(true);
  });

  it("returns empty array for unknown agent", () => {
    const sources = getChainSources("unknown-agent");
    expect(sources).toEqual([]);
  });
});

describe("Mapper Functions", () => {
  describe("ux-to-legal mapper", () => {
    it("transforms UX output to legal input", () => {
      const mapper = mapperRegistry.get("ux-to-legal");
      expect(mapper).toBeDefined();

      const uxOutput = {
        findings: [
          {
            title: "Missing alt text",
            description: "Images lack alternative text",
            severity: "high",
            category: "accessibility",
          },
          {
            title: "Low contrast",
            description: "Text contrast is below WCAG standards",
            severity: "medium",
            category: "accessibility",
          },
          {
            title: "Visual clutter",
            description: "Too many elements on screen",
            severity: "low",
            category: "aesthetics",
          },
        ],
        summary: "Accessibility issues found",
      };

      const legalInput = mapper!.map(uxOutput);

      expect(legalInput.documentType).toBe("UX Analysis Report");
      expect(legalInput.jurisdiction).toBe("US");
      expect(legalInput.focusAreas).toContain("accessibility");
      expect(legalInput.originalAnalysis).toBeDefined();
    });

    it("handles empty findings", () => {
      const mapper = mapperRegistry.get("ux-to-legal");
      expect(mapper).toBeDefined();

      const legalInput = mapper!.map({
        findings: [],
        summary: "No issues",
      }) as {
        originalAnalysis: { findings: unknown[] };
      };
      expect(legalInput.originalAnalysis.findings).toEqual([]);
    });
  });

  describe("ux-to-finance mapper", () => {
    it("transforms UX recommendations to finance initiatives", () => {
      const mapper = mapperRegistry.get("ux-to-finance");
      expect(mapper).toBeDefined();

      const uxOutput = {
        recommendations: [
          {
            title: "Improve navigation",
            description: "Simplify the main menu",
            effort: "medium",
            impact: "high",
          },
        ],
        scores: { usability: 75 },
      };

      const financeInput = mapper!.map(uxOutput) as {
        analysisType: string;
        initiatives: Array<{ name: string }>;
      };

      expect(financeInput.analysisType).toBe("project_budget");
      expect(financeInput.initiatives).toBeDefined();
      expect(financeInput.initiatives.length).toBe(1);
      expect(financeInput.initiatives[0].name).toBe("Improve navigation");
    });
  });

  describe("legal-to-finance mapper", () => {
    it("transforms legal findings to risk items", () => {
      const mapper = mapperRegistry.get("legal-to-finance");
      expect(mapper).toBeDefined();

      const legalOutput = {
        findings: [
          {
            title: "ADA violation",
            description: "Accessibility non-compliance",
            severity: "critical",
          },
        ],
        recommendations: [
          {
            title: "Remediate issues",
            description: "Fix accessibility gaps",
            priority: "high",
          },
        ],
        summary: "Legal review complete",
      };

      const financeInput = mapper!.map(legalOutput) as {
        analysisType: string;
        riskItems: Array<{ estimatedExposure: string }>;
      };

      expect(financeInput.analysisType).toBe("risk_assessment");
      expect(financeInput.riskItems).toBeDefined();
      expect(financeInput.riskItems.length).toBe(1);
      expect(financeInput.riskItems[0].estimatedExposure).toBe("high");
    });
  });

  describe("finance-to-legal mapper", () => {
    it("transforms financial projections for legal review", () => {
      const mapper = mapperRegistry.get("finance-to-legal");
      expect(mapper).toBeDefined();

      const financeOutput = {
        projections: {
          revenue: 100000,
          costs: 50000,
        },
        budget: {
          total: 50000,
        },
      };

      const legalInput = mapper!.map(financeOutput);

      expect(legalInput.documentType).toBe("Financial Projection");
      expect(legalInput.focusAreas).toContain("financial_regulations");
      expect(legalInput.originalAnalysis).toBeDefined();
    });
  });
});

describe("Mapper Properties", () => {
  it("all mappers have isLossy flag", () => {
    const mappers = mapperRegistry.list();
    for (const mapper of mappers) {
      // isLossy can be true, false, or undefined (defaults to false)
      expect(
        typeof mapper.isLossy === "boolean" || mapper.isLossy === undefined,
      ).toBe(true);
    }
  });

  it("ux-to-legal is marked as lossy", () => {
    const mapper = mapperRegistry.get("ux-to-legal");
    expect(mapper?.isLossy).toBe(true);
  });
});
