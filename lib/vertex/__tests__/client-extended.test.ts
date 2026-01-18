/**
 * Vertex AI Client Extended Tests
 *
 * Tests for API payload construction, error handling, and token parsing.
 * These tests complement client.test.ts with additional coverage areas.
 *
 * @see docs/IMPEMENTATION.md - Phase 3.6 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Mock google-auth-library BEFORE any imports
vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return {
        getAccessToken: async () => ({ token: "mock-test-token" }),
      };
    }
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Vertex AI Client - Extended Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("API Payload Construction", () => {
    const TestSchema = z.object({
      result: z.string(),
      confidence: z.number(),
    });

    it("constructs correct API payload with required fields", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production"); // Force non-test mode
      vi.stubEnv("K_SERVICE", ""); // Not in Cloud Run

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"result": "test", "confidence": 0.95}' }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      await queryVertexAI("Test prompt", TestSchema);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      // Verify URL structure
      expect(url).toContain("aiplatform.googleapis.com");
      expect(url).toContain("generateContent");
      expect(url).toContain("gemini-3-pro-preview");
      expect(url).toContain("global");

      // Verify request headers
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers["Authorization"]).toContain("Bearer");

      // Verify request body structure
      const body = JSON.parse(options.body);
      expect(body).toHaveProperty("contents");
      expect(body.contents[0]).toHaveProperty("role", "user");
      expect(body.contents[0].parts[0]).toHaveProperty("text", "Test prompt");
    });

    it("includes JSON output mode configuration", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"result": "test", "confidence": 0.95}' }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      await queryVertexAI("Test prompt", TestSchema);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Verify generationConfig includes JSON output mode
      expect(body.generationConfig).toBeDefined();
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.maxOutputTokens).toBeDefined();
      expect(body.generationConfig.temperature).toBeDefined();
    });

    it("includes safety settings in payload", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"result": "test", "confidence": 0.95}' }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      await queryVertexAI("Test prompt", TestSchema);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Verify safety settings
      expect(body.safetySettings).toBeDefined();
      expect(body.safetySettings.length).toBeGreaterThan(0);
      expect(body.safetySettings[0]).toHaveProperty("category");
      expect(body.safetySettings[0]).toHaveProperty("threshold");
    });

    it("includes file data when files are provided", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"result": "test", "confidence": 0.95}' }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      await queryVertexAI("Analyze this document", TestSchema, {
        files: [{ mimeType: "application/pdf", uri: "gs://bucket/file.pdf" }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Verify file data is included
      expect(body.contents[0].parts.length).toBeGreaterThan(1);
      const filePart = body.contents[0].parts.find(
        (p: Record<string, unknown>) => p.fileData,
      );
      expect(filePart).toBeDefined();
      expect(filePart.fileData.mimeType).toBe("application/pdf");
      expect(filePart.fileData.fileUri).toBe("gs://bucket/file.pdf");
    });
  });

  describe("Error Handling", () => {
    const TestSchema = z.object({
      result: z.string(),
    });

    it("handles Vertex API HTTP error response", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal server error"),
      });

      await expect(queryVertexAI("Test", TestSchema)).rejects.toThrow(
        "Vertex AI error: 500",
      );
    });

    it("handles Vertex API timeout", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await expect(queryVertexAI("Test", TestSchema)).rejects.toThrow(
        "Network timeout",
      );
    });

    it("handles empty response from Vertex AI", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [],
          }),
      });

      await expect(queryVertexAI("Test", TestSchema)).rejects.toThrow(
        "No content in Vertex AI response",
      );
    });

    it("handles invalid JSON in response", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: "not valid json" }],
                },
                finishReason: "STOP",
              },
            ],
          }),
      });

      await expect(queryVertexAI("Test", TestSchema)).rejects.toThrow();
    });

    it("handles schema validation failure", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"wrongField": "value"}' }],
                },
                finishReason: "STOP",
              },
            ],
          }),
      });

      await expect(queryVertexAI("Test", TestSchema)).rejects.toThrow();
    });
  });

  describe("Token Usage Parsing", () => {
    const TestSchema = z.object({
      message: z.string(),
    });

    it("parses token usage from metadata correctly", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"message": "Hello"}' }],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 150,
              candidatesTokenCount: 75,
              totalTokenCount: 225,
            },
          }),
      });

      const response = await queryVertexAI("Test", TestSchema);

      expect(response.usage.inputTokens).toBe(150);
      expect(response.usage.outputTokens).toBe(75);
      expect(response.usage.totalTokens).toBe(225);
    });

    it("handles missing usage metadata gracefully", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"message": "Hello"}' }],
                },
                finishReason: "STOP",
              },
            ],
          }),
      });

      const response = await queryVertexAI("Test", TestSchema);

      expect(response.usage.inputTokens).toBe(0);
      expect(response.usage.outputTokens).toBe(0);
      expect(response.usage.totalTokens).toBe(0);
    });

    it("extracts finish reason from response", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"message": "Hello"}' }],
                },
                finishReason: "MAX_TOKENS",
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      const response = await queryVertexAI("Test", TestSchema);

      expect(response.metadata.finishReason).toBe("MAX_TOKENS");
    });

    it("extracts safety ratings when present", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"message": "Hello"}' }],
                },
                finishReason: "STOP",
                safetyRatings: [
                  {
                    category: "HARM_CATEGORY_HARASSMENT",
                    probability: "NEGLIGIBLE",
                  },
                ],
              },
            ],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          }),
      });

      const response = await queryVertexAI("Test", TestSchema);

      expect(response.metadata.safetyRatings).toBeDefined();
      expect(response.metadata.safetyRatings).toHaveLength(1);
      expect(response.metadata.safetyRatings![0].category).toBe(
        "HARM_CATEGORY_HARASSMENT",
      );
    });
  });

  describe("Model Selection", () => {
    const TestSchema = z.object({ test: z.string() });

    it("uses Pro model by default", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '{"test": "value"}' }] },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            },
          }),
      });

      const response = await queryVertexAI("Test", TestSchema);

      expect(mockFetch.mock.calls[0][0]).toContain("gemini-3-pro-preview");
      expect(response.metadata.model).toBe("gemini-3-pro-preview");
    });

    it("uses Flash model when specified", async () => {
      vi.resetModules();
      vi.stubEnv("VERTEX_AI_MOCK", "false");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("K_SERVICE", "");

      const { queryVertexAI } = await import("../client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: { parts: [{ text: '{"test": "value"}' }] },
                finishReason: "STOP",
              },
            ],
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              totalTokenCount: 15,
            },
          }),
      });

      const response = await queryVertexAI("Test", TestSchema, {
        model: "flash",
      });

      expect(mockFetch.mock.calls[0][0]).toContain("gemini-3-flash-preview");
      expect(response.metadata.model).toBe("gemini-3-flash-preview");
    });
  });
});
