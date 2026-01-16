/**
 * useAgentQuery Hook
 *
 * TanStack Query mutation hook for executing agent queries.
 *
 * @see docs/IMPLEMENTATION.md - Phase 4
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

export interface QueryInput {
  agentId: string;
  sessionId?: string;
  inputs: Record<string, unknown>;
  files?: Array<{
    fieldName: string;
    gcsPath: string;
    filename: string;
    mimeType?: string;
  }>;
}

export interface QueryOutput {
  sessionId: string;
  output: unknown;
  markdown: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metadata: {
    agentId: string;
    model: string;
    durationMs: number;
  };
}

export interface QueryError {
  error: string;
  message: string;
  upgradeUrl?: string;
  tokensRemaining?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const queryKeys = {
  sessions: ["sessions"] as const,
};

// =============================================================================
// API Functions
// =============================================================================

async function executeQuery(input: QueryInput): Promise<QueryOutput> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Query failed");
  }

  return response.json();
}

// =============================================================================
// Hooks
// =============================================================================

interface UseAgentQueryOptions {
  /** Callback on successful query */
  onSuccess?: (data: QueryOutput) => void;
  /** Callback on query error */
  onError?: (error: Error) => void;
}

/**
 * Hook to execute agent queries
 */
export function useAgentQuery(options?: UseAgentQueryOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: executeQuery,
    onSuccess: (data) => {
      // Invalidate sessions cache to refresh list
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });

      // Invalidate usage summary to reflect deducted tokens
      queryClient.invalidateQueries({ queryKey: ["usage-summary"] });

      // Call user callback
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
  });
}
