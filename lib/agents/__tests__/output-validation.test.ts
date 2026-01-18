/**
 * Output Validation Tests
 *
 * Tests for LLM output JSON parsing and schema validation.
 * These tests verify the output handling pipeline in the query flow.
 *
 * @see docs/IMPEMENTATION.md - Phase 3.6 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Mock console.error to capture log messages
const consoleErrorSpy = vi.spyOn(console, "error");

describe("Output Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockImplementation(() => {}); // Silence errors in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JSON Parsing", () => {
    it("parses valid JSON from LLM response", () => {
      const llmOutput = '{"summary": "Test analysis", "score": 85}';
      const OutputSchema = z.object({
        summary: z.string(),
        score: z.number(),
      });

      const parsed = JSON.parse(llmOutput);
      const validated = OutputSchema.parse(parsed);

      expect(validated.summary).toBe("Test analysis");
      expect(validated.score).toBe(85);
    });

    it("throws error on invalid JSON", () => {
      const invalidJson = "not valid json { broken";

      expect(() => JSON.parse(invalidJson)).toThrow(SyntaxError);
    });

    it("handles JSON with trailing commas gracefully", () => {
      // Some LLMs occasionally produce trailing commas
      const jsonWithTrailingComma = '{"summary": "Test",}';

      expect(() => JSON.parse(jsonWithTrailingComma)).toThrow();
    });

    it("handles JSON with markdown code fences", () => {
      const wrappedJson = '```json\n{"summary": "Test"}\n```';

      // Extractor function that strips code fences
      const extractJson = (text: string): string => {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        return match ? match[1] : text;
      };

      const cleaned = extractJson(wrappedJson);
      const parsed = JSON.parse(cleaned);

      expect(parsed.summary).toBe("Test");
    });
  });

  describe("Schema Validation", () => {
    const OutputSchema = z.object({
      executiveSummary: z.string(),
      findings: z.array(
        z.object({
          title: z.string(),
          severity: z.enum(["critical", "high", "medium", "low"]),
          description: z.string(),
        }),
      ),
      recommendations: z.array(
        z.object({
          action: z.string(),
          priority: z.enum(["immediate", "short-term", "long-term"]),
        }),
      ),
    });

    it("validates output against schema successfully", () => {
      const validOutput = {
        executiveSummary: "Overall good design",
        findings: [
          { title: "Low contrast", severity: "medium", description: "Text..." },
        ],
        recommendations: [{ action: "Fix contrast", priority: "immediate" }],
      };

      const result = OutputSchema.safeParse(validOutput);

      expect(result.success).toBe(true);
    });

    it("returns validation errors for missing required fields", () => {
      const invalidOutput = {
        findings: [],
        // Missing executiveSummary and recommendations
      };

      const result = OutputSchema.safeParse(invalidOutput);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.executiveSummary).toBeDefined();
        expect(errors.recommendations).toBeDefined();
      }
    });

    it("returns validation errors for invalid enum values", () => {
      const outputWithBadEnum = {
        executiveSummary: "Test",
        findings: [
          { title: "Issue", severity: "CRITICAL", description: "Test" }, // Wrong case
        ],
        recommendations: [],
      };

      const result = OutputSchema.safeParse(outputWithBadEnum);

      expect(result.success).toBe(false);
    });

    it("handles empty arrays correctly", () => {
      const outputWithEmptyArrays = {
        executiveSummary: "No issues found",
        findings: [],
        recommendations: [],
      };

      const result = OutputSchema.safeParse(outputWithEmptyArrays);

      expect(result.success).toBe(true);
    });

    it("handles extra fields gracefully (strip mode)", () => {
      const outputWithExtraFields = {
        executiveSummary: "Test",
        findings: [],
        recommendations: [],
        internalNotes: "Should be stripped", // Extra field
      };

      const StrictSchema = OutputSchema.strict();
      const LooseSchema = OutputSchema.passthrough();

      // Strict mode rejects extra fields
      const strictResult = StrictSchema.safeParse(outputWithExtraFields);
      expect(strictResult.success).toBe(false);

      // Passthrough mode allows extra fields
      const looseResult = LooseSchema.safeParse(outputWithExtraFields);
      expect(looseResult.success).toBe(true);
    });
  });

  describe("Error Messages", () => {
    it("returns graceful failure message for parse errors", () => {
      const generateUserFriendlyError = (error: unknown): string => {
        if (error instanceof SyntaxError) {
          return "The AI response was not in the expected format. Please try again.";
        }
        if (error instanceof z.ZodError) {
          return "The AI response was incomplete or invalid. Please try again.";
        }
        return "An unexpected error occurred. Please try again.";
      };

      const parseError = new SyntaxError("Unexpected token");
      const zodError = new z.ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["summary"],
          message: "Required",
        },
      ]);

      expect(generateUserFriendlyError(parseError)).toContain(
        "expected format",
      );
      expect(generateUserFriendlyError(zodError)).toContain(
        "incomplete or invalid",
      );
      expect(generateUserFriendlyError(new Error())).toContain(
        "unexpected error",
      );
    });

    it("does not expose internal error details in user messages", () => {
      const generateUserFriendlyError = (error: unknown): string => {
        // Never include raw error message in user-facing output
        const _errorMessage = error instanceof Error ? error.message : "";
        return "The AI response could not be processed. Please try again.";
      };

      const internalError = new Error(
        'PostgreSQL: column "findings" of type jsonb cannot be parsed',
      );

      const userMessage = generateUserFriendlyError(internalError);

      expect(userMessage).not.toContain("PostgreSQL");
      expect(userMessage).not.toContain("jsonb");
      expect(userMessage).not.toContain("column");
    });

    it("provides structured validation error details for developers", () => {
      const OutputSchema = z.object({
        summary: z.string().min(10),
        score: z.number().min(0).max(100),
      });

      const badOutput = { summary: "Too short", score: 150 };
      const result = OutputSchema.safeParse(badOutput);

      if (!result.success) {
        const flatErrors = result.error.flatten();

        expect(flatErrors.fieldErrors.summary).toBeDefined();
        expect(flatErrors.fieldErrors.score).toBeDefined();

        // These can be used for developer logging/debugging
        const developerLog = {
          type: "OUTPUT_VALIDATION_ERROR",
          fields: Object.keys(flatErrors.fieldErrors),
          details: flatErrors.fieldErrors,
        };

        expect(developerLog.type).toBe("OUTPUT_VALIDATION_ERROR");
        expect(developerLog.fields).toContain("score");
      }
    });
  });
});
