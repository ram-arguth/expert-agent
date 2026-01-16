/**
 * useAgents Hook
 *
 * TanStack Query hook for fetching agent catalog.
 *
 * @see docs/IMPLEMENTATION.md - Phase 4
 */

"use client";

import { useQuery } from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

export interface Agent {
  id: string;
  displayName: string;
  description: string;
  category?: string;
  iconUrl?: string;
  isPublic: boolean;
  isBeta: boolean;
}

export interface AgentsResponse {
  agents: Agent[];
}

// =============================================================================
// Query Keys
// =============================================================================

export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
  detail: (id: string) => [...agentKeys.all, "detail", id] as const,
};

// =============================================================================
// API Functions
// =============================================================================

async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch("/api/agents");

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to fetch agents");
  }

  const data: AgentsResponse = await response.json();
  return data.agents;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch all available agents
 */
export function useAgents() {
  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: fetchAgents,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });
}

/**
 * Hook to fetch a specific agent by ID
 */
export function useAgent(agentId: string) {
  const { data: agents, ...rest } = useAgents();

  return {
    ...rest,
    data: agents?.find((agent) => agent.id === agentId),
  };
}
