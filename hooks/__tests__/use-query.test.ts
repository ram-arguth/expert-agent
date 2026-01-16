/**
 * useAgentQuery Hook Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAgentQuery, type QueryOutput } from "../use-query";
import * as React from "react";

// Mock fetch
global.fetch = vi.fn();

// Test wrapper with React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  function TestQueryWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }
  return TestQueryWrapper;
}

const mockQueryOutput: QueryOutput = {
  sessionId: "session-123",
  output: { summary: "Test result" },
  markdown: "# Test Result\n\nTest summary",
  usage: {
    inputTokens: 100,
    outputTokens: 500,
    totalTokens: 600,
  },
  metadata: {
    agentId: "ux-analyst",
    model: "gemini-3-pro-preview",
    durationMs: 1500,
  },
};

describe("useAgentQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends query to API", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockQueryOutput),
    } as Response);

    const { result } = renderHook(() => useAgentQuery(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: { productType: "web-app" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "ux-analyst",
        inputs: { productType: "web-app" },
      }),
    });
  });

  it("returns loading state during mutation", async () => {
    let resolvePromise: (value: Response) => void;
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { result } = renderHook(() => useAgentQuery(), {
      wrapper: createWrapper(),
    });

    // Start mutation
    act(() => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: {},
      });
    });

    // Wait for pending state
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });

    // Resolve the promise
    act(() => {
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockQueryOutput),
      } as Response);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("returns success state with data", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockQueryOutput),
    } as Response);

    const { result } = renderHook(() => useAgentQuery(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: {},
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockQueryOutput);
    expect(result.current.data?.sessionId).toBe("session-123");
  });

  it("returns error state on failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Quota exceeded" }),
    } as Response);

    const { result } = renderHook(() => useAgentQuery(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: {},
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Quota exceeded");
  });

  it("calls onSuccess callback", async () => {
    const onSuccess = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockQueryOutput),
    } as Response);

    const { result } = renderHook(() => useAgentQuery({ onSuccess }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: {},
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledWith(mockQueryOutput);
  });

  it("calls onError callback", async () => {
    const onError = vi.fn();
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Error" }),
    } as Response);

    const { result } = renderHook(() => useAgentQuery({ onError }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({
        agentId: "ux-analyst",
        inputs: {},
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("passes correct payload with files", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockQueryOutput),
    } as Response);

    const { result } = renderHook(() => useAgentQuery(), {
      wrapper: createWrapper(),
    });

    const input = {
      agentId: "ux-analyst",
      sessionId: "session-abc",
      inputs: { productType: "mobile-app" },
      files: [
        {
          fieldName: "screenshot",
          gcsPath: "uploads/user-123/file.png",
          filename: "screenshot.png",
          mimeType: "image/png",
        },
      ],
    };

    await act(async () => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  });
});
