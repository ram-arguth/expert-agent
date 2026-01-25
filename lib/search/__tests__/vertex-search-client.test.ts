/**
 * Vertex AI Search Client Tests
 *
 * Tests for the Vertex AI Search (Discovery Engine) client.
 * All tests run in mock mode to avoid GCP costs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchDataStore, SearchResult } from "../vertex-search-client";

describe("Vertex AI Search Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Mock Mode", () => {
    it("returns mock results when VERTEX_SEARCH_MOCK=true", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "employee policy",
        dataStoreId: "test-datastore",
      });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Company Policy v2.pdf");
      expect(results[0].snippet).toContain("employee policy");
      expect(results[1].title).toBe("Technical Manual");
    });

    it("returns mock results in test environment", async () => {
      // NODE_ENV is already 'test' in vitest
      delete process.env.VERTEX_SEARCH_MOCK;

      const results = await searchDataStore({
        query: "test query",
        dataStoreId: "test-datastore",
      });

      expect(results).toHaveLength(2);
      expect(results[0].snippet).toContain("test query");
    });

    it("includes query in mock snippets", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const query = "compliance regulations";
      const results = await searchDataStore({
        query,
        dataStoreId: "test-datastore",
      });

      expect(results[0].snippet).toContain(query);
      expect(results[1].snippet).toContain(query);
    });

    it("includes source in mock results", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: "test-datastore",
      });

      expect(results[0].source).toContain("gs://");
      expect(results[1].source).toContain("gs://");
    });

    it("returns results with expected structure", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: "test-datastore",
      });

      results.forEach((result) => {
        expect(result).toHaveProperty("title");
        expect(result).toHaveProperty("snippet");
        expect(result).toHaveProperty("source");
        expect(typeof result.title).toBe("string");
        expect(typeof result.snippet).toBe("string");
      });
    });

    it("handles empty query string", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "",
        dataStoreId: "test-datastore",
      });

      // Mock still returns results for empty query
      expect(results).toHaveLength(2);
    });

    it("handles special characters in query", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const query = 'test "quoted" & <script>alert("xss")</script>';
      const results = await searchDataStore({
        query,
        dataStoreId: "test-datastore",
      });

      expect(results).toHaveLength(2);
      expect(results[0].snippet).toContain(query);
    });
  });

  describe("SearchResult Interface", () => {
    it("has correct type structure", () => {
      const result: SearchResult = {
        title: "Test Title",
        snippet: "Test snippet content",
        link: "https://example.com",
        source: "gs://bucket/file.pdf",
      };

      expect(result.title).toBeDefined();
      expect(result.snippet).toBeDefined();
      expect(result.link).toBeDefined();
      expect(result.source).toBeDefined();
    });

    it("allows optional link", () => {
      const result: SearchResult = {
        title: "Test Title",
        snippet: "Test snippet content",
        source: "gs://bucket/file.pdf",
      };

      expect(result.link).toBeUndefined();
    });

    it("allows optional source", () => {
      const result: SearchResult = {
        title: "Test Title",
        snippet: "Test snippet content",
        link: "https://example.com",
      };

      expect(result.source).toBeUndefined();
    });
  });

  describe("DataStore ID Handling", () => {
    it("accepts short datastore ID format", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: "my-datastore",
      });

      expect(results).toHaveLength(2);
    });

    it("accepts full resource path format", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const fullPath =
        "projects/my-project/locations/global/collections/default_collection/dataStores/my-store/servingConfigs/default_search";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: fullPath,
      });

      expect(results).toHaveLength(2);
    });
  });

  describe("PageSize Option", () => {
    it("accepts custom pageSize", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      // Even though mock doesn't use pageSize, it should accept the option
      const results = await searchDataStore({
        query: "test",
        dataStoreId: "test-datastore",
        pageSize: 10,
      });

      expect(results).toHaveLength(2); // Mock always returns 2
    });

    it("works without pageSize (uses default)", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: "test-datastore",
        // no pageSize specified
      });

      expect(results).toHaveLength(2);
    });
  });

  describe("Query Integration", () => {
    it("is used by query route for enterprise RAG", async () => {
      // This tests that the module exports the expected function
      expect(typeof searchDataStore).toBe("function");
    });

    it("returns array that can be mapped to context string", async () => {
      process.env.VERTEX_SEARCH_MOCK = "true";

      const results = await searchDataStore({
        query: "test",
        dataStoreId: "test-datastore",
      });

      // Simulate what query route does
      const context = results
        .map((r) => `[Source: ${r.title}]\n${r.snippet}`)
        .join("\n\n");

      expect(context).toContain("[Source:");
      expect(context).toContain("Company Policy");
    });
  });
});
