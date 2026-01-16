/**
 * useAgents Hook Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAgents, useAgent, type Agent } from "../use-agents";
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

const mockAgents: Agent[] = [
  {
    id: "ux-analyst",
    displayName: "UX Analyst",
    description: "Analyzes user experience",
    category: "design",
    isPublic: true,
    isBeta: false,
  },
  {
    id: "legal-advisor",
    displayName: "Legal Advisor",
    description: "Provides legal guidance",
    category: "legal",
    isPublic: true,
    isBeta: true,
  },
];

describe("useAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches agents from API", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: mockAgents }),
    } as Response);

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe("ux-analyst");
  });

  it("returns loading state initially", () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns error on API failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Service unavailable" }),
    } as Response);

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Service unavailable");
  });

  it("caches data with TanStack Query", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: mockAgents }),
    } as Response);

    const wrapper = createWrapper();

    // First render
    const { result: result1 } = renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Second render uses cache
    const { result: result2 } = renderHook(() => useAgents(), { wrapper });

    // Should use cached data
    expect(result2.current.data).toEqual(mockAgents);
    // Should only have fetched once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles empty agent list", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: [] }),
    } as Response);

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
  });
});

describe("useAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds specific agent by ID", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: mockAgents }),
    } as Response);

    const { result } = renderHook(() => useAgent("legal-advisor"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe("legal-advisor");
    expect(result.current.data?.displayName).toBe("Legal Advisor");
  });

  it("returns undefined for unknown agent ID", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: mockAgents }),
    } as Response);

    const { result } = renderHook(() => useAgent("unknown-agent"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});
