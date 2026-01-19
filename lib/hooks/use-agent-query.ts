/**
 * Agent Query Hook
 *
 * TanStack Query mutation hook for submitting agent queries.
 * Handles file uploads, validation, and API calls.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.2
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useWorkspace,
  createOrgHeaders,
} from "@/lib/context/workspace-context";
import {
  uploadFiles,
  extractFilesFromFormData,
  type UploadedFile,
  type UploadProgress,
} from "@/lib/services/file-upload-service";
import { useState, useCallback } from "react";

export interface QueryResult {
  sessionId: string;
  agentId: string;
  output: unknown;
  markdown: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
}

export interface QueryError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface UseAgentQueryOptions {
  /** Called when query starts */
  onStart?: () => void;
  /** Called with upload progress */
  onUploadProgress?: (statuses: UploadProgress[]) => void;
  /** Called on successful query */
  onSuccess?: (result: QueryResult) => void;
  /** Called on error */
  onError?: (error: QueryError) => void;
  /** Existing session ID for follow-up queries */
  sessionId?: string;
}

export interface SubmitData {
  inputs: Record<string, unknown>;
  sessionId?: string;
}

/**
 * Hook for submitting queries to an agent
 */
export function useAgentQuery(
  agentId: string,
  options: UseAgentQueryOptions = {},
) {
  const { activeOrgId } = useWorkspace();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const mutation = useMutation<QueryResult, QueryError, SubmitData>({
    mutationFn: async ({ inputs, sessionId }) => {
      options.onStart?.();

      // Get org headers for API calls
      const headers = createOrgHeaders(activeOrgId);

      // 1. Extract and upload files
      const fileEntries = extractFilesFromFormData(inputs);
      let uploadedFiles: UploadedFile[] = [];

      if (fileEntries.length > 0) {
        uploadedFiles = await uploadFiles(
          fileEntries,
          agentId,
          headers,
          (statuses) => {
            setUploadProgress(statuses);
            options.onUploadProgress?.(statuses);
          },
        );
      }

      // 2. Prepare inputs without File objects
      const cleanInputs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(inputs)) {
        if (!(value instanceof File) && !Array.isArray(value)) {
          cleanInputs[key] = value;
        } else if (
          Array.isArray(value) &&
          value.length > 0 &&
          !(value[0] instanceof File)
        ) {
          cleanInputs[key] = value;
        }
      }

      // 3. Submit query to API
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          agentId,
          sessionId: sessionId || options.sessionId,
          inputs: cleanInputs,
          files: uploadedFiles.map(
            ({ fieldName, gcsPath, filename, mimeType }) => ({
              fieldName,
              gcsPath,
              filename,
              mimeType,
            }),
          ),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          message:
            errorData.error || `Query failed with status ${response.status}`,
          code: errorData.code || "QUERY_ERROR",
          details: errorData.details,
        } as QueryError;
      }

      const result = await response.json();

      return {
        sessionId: result.sessionId,
        agentId: result.agentId,
        output: result.output,
        markdown: result.markdown,
        tokensUsed: {
          input: result.usage?.inputTokens || 0,
          output: result.usage?.outputTokens || 0,
          total: result.usage?.totalTokens || 0,
        },
      };
    },
    onSuccess: (result) => {
      // Invalidate sessions query to refresh sidebar
      queryClient.invalidateQueries({ queryKey: ["sessions", agentId] });
      options.onSuccess?.(result);
    },
    onError: (error) => {
      options.onError?.(error);
    },
    onSettled: () => {
      // Clear upload progress
      setUploadProgress([]);
    },
  });

  const submit = useCallback(
    (data: SubmitData) => mutation.mutate(data),
    [mutation],
  );

  const submitAsync = useCallback(
    (data: SubmitData) => mutation.mutateAsync(data),
    [mutation],
  );

  return {
    /** Submit a query */
    submit,
    /** Submit a query and await result */
    submitAsync,
    /** True while uploading files or awaiting response */
    isLoading: mutation.isPending,
    /** True if query failed */
    isError: mutation.isError,
    /** Error details */
    error: mutation.error,
    /** Query result */
    data: mutation.data,
    /** File upload progress */
    uploadProgress,
    /** Reset mutation state */
    reset: mutation.reset,
  };
}

export default useAgentQuery;
