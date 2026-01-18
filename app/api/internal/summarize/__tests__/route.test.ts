/**
 * Internal Summarization API Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock summarization service
vi.mock("@/lib/memory/summarization-service", () => ({
  summarizeBatch: vi.fn(),
}));

import { summarizeBatch } from "@/lib/memory/summarization-service";
import type { Mock } from "vitest";

const mockSummarizeBatch = summarizeBatch as Mock;

// Set up environment
beforeEach(() => {
  process.env.INTERNAL_API_SECRET = "test-secret-123";
  vi.clearAllMocks();
});

function createRequest(
  options: { secret?: string; limit?: string } = {},
): NextRequest {
  const url = options.limit
    ? `http://localhost/api/internal/summarize?limit=${options.limit}`
    : "http://localhost/api/internal/summarize";

  const headers = new Headers();
  if (options.secret !== undefined) {
    headers.set("x-internal-secret", options.secret);
  }

  return new NextRequest(url, {
    method: "POST",
    headers,
  });
}

describe("POST /api/internal/summarize", () => {
  describe("authentication", () => {
    it("returns 401 for missing secret header", async () => {
      const response = await POST(createRequest({}));

      expect(response.status).toBe(401);
    });

    it("returns 401 for invalid secret", async () => {
      const response = await POST(createRequest({ secret: "wrong-secret" }));

      expect(response.status).toBe(401);
    });

    it("accepts valid secret", async () => {
      mockSummarizeBatch.mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });

      const response = await POST(createRequest({ secret: "test-secret-123" }));

      expect(response.status).toBe(200);
    });
  });

  describe("batch processing", () => {
    it("returns summarization results", async () => {
      mockSummarizeBatch.mockResolvedValue({
        processed: 5,
        succeeded: 4,
        failed: 1,
        results: [
          { sessionId: "s1", success: true, summaryUrl: "gs://bucket/s1.json" },
        ],
      });

      const response = await POST(createRequest({ secret: "test-secret-123" }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.processed).toBe(5);
      expect(data.succeeded).toBe(4);
    });

    it("respects limit parameter", async () => {
      mockSummarizeBatch.mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });

      await POST(createRequest({ secret: "test-secret-123", limit: "25" }));

      expect(mockSummarizeBatch).toHaveBeenCalledWith(25);
    });

    it("caps limit at 100", async () => {
      mockSummarizeBatch.mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      });

      await POST(createRequest({ secret: "test-secret-123", limit: "500" }));

      expect(mockSummarizeBatch).toHaveBeenCalledWith(100);
    });
  });
});

describe("GET /api/internal/summarize", () => {
  it("returns health check info", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
  });
});
