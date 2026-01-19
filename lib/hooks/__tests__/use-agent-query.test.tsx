/**
 * useAgentQuery Hook Tests
 *
 * Tests for the agent query mutation hook.
 *
 * @see lib/hooks/use-agent-query.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useAgentQuery } from "../use-agent-query";

// Mock workspace context
vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    activeOrgId: null,
    activeOrg: null,
  })),
  createOrgHeaders: vi.fn((orgId: string | null) =>
    orgId ? { "X-Active-Org": orgId } : {},
  ),
}));

// Mock file upload service
vi.mock("@/lib/services/file-upload-service", () => ({
  uploadFiles: vi.fn().mockResolvedValue([]),
  extractFilesFromFormData: vi.fn().mockReturnValue([]),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useAgentQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: "session-123",
        agentId: "ux-analyst",
        output: { findings: [] },
        markdown: "# Analysis Results",
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300,
        },
      }),
    });
  });

  describe("submit", () => {
    it("submits query to API", async () => {
      const { result } = renderHook(() => useAgentQuery("ux-analyst"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.submit({
          inputs: { url: "https://example.com" },
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/query",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ux-analyst"),
        }),
      );
    });

    it("returns query result on success", async () => {
      const { result } = renderHook(() => useAgentQuery("ux-analyst"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.submit({
          inputs: { url: "https://example.com" },
        });
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data).toEqual({
        sessionId: "session-123",
        agentId: "ux-analyst",
        output: { findings: [] },
        markdown: "# Analysis Results",
        tokensUsed: {
          input: 100,
          output: 200,
          total: 300,
        },
      });
    });

    it("transitions from loading to complete", async () => {
      const { result } = renderHook(() => useAgentQuery("ux-analyst"), {
        wrapper: createWrapper(),
      });

      // Initially not loading
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      // After completion, should not be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeDefined();
      });
    });

    it("includes session ID for follow-up queries", async () => {
      const { result } = renderHook(
        () => useAgentQuery("ux-analyst", { sessionId: "existing-session" }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.submit({ inputs: { followUp: "Tell me more" } });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/query",
        expect.objectContaining({
          body: expect.stringContaining("existing-session"),
        }),
      );
    });
  });

  describe("error handling", () => {
    it("handles API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: "Rate limit exceeded",
          code: "RATE_LIMIT",
        }),
      });

      const { result } = renderHook(() => useAgentQuery("ux-analyst"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual({
        message: "Rate limit exceeded",
        code: "RATE_LIMIT",
        details: undefined,
      });
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAgentQuery("ux-analyst"), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it("calls onError callback", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Quota exceeded" }),
      });

      const onError = vi.fn();
      const { result } = renderHook(
        () => useAgentQuery("ux-analyst", { onError }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });
  });

  describe("callbacks", () => {
    it("calls onStart when submission begins", async () => {
      const onStart = vi.fn();
      const { result } = renderHook(
        () => useAgentQuery("ux-analyst", { onStart }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      expect(onStart).toHaveBeenCalled();
    });

    it("calls onSuccess with result", async () => {
      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useAgentQuery("ux-analyst", { onSuccess }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.submit({ inputs: {} });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: "session-123",
          }),
        );
      });
    });
  });
});
