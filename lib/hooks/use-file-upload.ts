/**
 * useFileUpload Hook
 *
 * Handles file uploads to GCS via signed URLs with progress tracking.
 * Follows the flow:
 * 1. Request signed URL from /api/upload
 * 2. Upload file to GCS using PUT with progress tracking
 * 3. Optionally confirm upload via /api/upload/confirm
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.1 File Upload
 */

import { useState, useCallback, useRef, useEffect } from "react";

// =============================================================================
// Types
// =============================================================================

export interface UploadedFile {
  id: string;
  file: File;
  label?: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  error?: string;
  previewUrl?: string;
  /** GCS path after successful upload */
  gcsPath?: string;
  /** File ID from the backend */
  fileId?: string;
}

export interface UploadOptions {
  /** Purpose of the upload (affects size limits) */
  purpose?: "query" | "context" | "avatar";
  /** Optional org ID for org context uploads */
  orgId?: string;
  /** Optional agent IDs for filtering context */
  agentIds?: string[];
  /** Whether to auto-confirm uploads */
  autoConfirm?: boolean;
}

export interface UploadResult {
  fileId: string;
  gcsPath: string;
  filename: string;
}

export interface UseFileUploadReturn {
  /** Array of files being tracked */
  files: UploadedFile[];
  /** Add files to the upload queue */
  addFiles: (newFiles: UploadedFile[]) => void;
  /** Start uploading pending files */
  uploadFiles: (options?: UploadOptions) => Promise<UploadResult[]>;
  /** Remove a file from the queue */
  removeFile: (fileId: string) => void;
  /** Clear all files */
  clearFiles: () => void;
  /** Retry a failed upload */
  retryFile: (
    fileId: string,
    options?: UploadOptions,
  ) => Promise<UploadResult | null>;
  /** Whether any upload is in progress */
  isUploading: boolean;
  /** Overall upload progress (0-100) */
  overallProgress: number;
  /** Get successfully uploaded files */
  completedFiles: UploadedFile[];
  /** Get files with errors */
  errorFiles: UploadedFile[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useFileUpload(): UseFileUploadReturn {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Cleanup abort controllers on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
    };
  }, []);

  // Add files to the queue
  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // Remove a file from the queue
  const removeFile = useCallback((fileId: string) => {
    // Abort any in-progress upload
    const controller = abortControllersRef.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(fileId);
    }

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    // Abort all in-progress uploads
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current.clear();

    setFiles([]);
  }, []);

  // Update a specific file's state
  const updateFile = useCallback(
    (fileId: string, updates: Partial<UploadedFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  // Upload a single file
  const uploadSingleFile = useCallback(
    async (
      uploadFile: UploadedFile,
      options: UploadOptions = {},
    ): Promise<UploadResult | null> => {
      const {
        purpose = "query",
        orgId,
        agentIds,
        autoConfirm = false,
      } = options;

      // Create abort controller for this upload
      const abortController = new AbortController();
      abortControllersRef.current.set(uploadFile.id, abortController);

      try {
        // Step 1: Request signed URL from our API
        updateFile(uploadFile.id, { status: "uploading", progress: 5 });

        const signedUrlResponse = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: uploadFile.file.name,
            mimeType: uploadFile.file.type,
            sizeBytes: uploadFile.file.size,
            purpose,
            orgId,
            agentIds,
          }),
          signal: abortController.signal,
        });

        if (!signedUrlResponse.ok) {
          const errorData = await signedUrlResponse.json();
          throw new Error(
            errorData.message ||
              `Failed to get upload URL (${signedUrlResponse.status})`,
          );
        }

        const { uploadUrl, gcsPath, fileId } = await signedUrlResponse.json();
        updateFile(uploadFile.id, { progress: 10, fileId, gcsPath });

        // Step 2: Upload to GCS with progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              // Progress from 10-95% during upload
              const progress =
                10 + Math.round((event.loaded / event.total) * 85);
              updateFile(uploadFile.id, { progress });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network error during upload"));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Upload cancelled"));
          });

          // Store abort handler
          abortController.signal.addEventListener("abort", () => {
            xhr.abort();
          });

          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", uploadFile.file.type);
          xhr.send(uploadFile.file);
        });

        updateFile(uploadFile.id, { progress: 95 });

        // Step 3: Optionally confirm the upload
        if (autoConfirm) {
          const confirmResponse = await fetch("/api/upload/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId }),
            signal: abortController.signal,
          });

          if (!confirmResponse.ok) {
            console.warn(
              "Failed to confirm upload, but file was uploaded successfully",
            );
          }
        }

        // Mark as complete
        updateFile(uploadFile.id, {
          status: "complete",
          progress: 100,
          gcsPath,
          fileId,
        });

        return { fileId, gcsPath, filename: uploadFile.file.name };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";

        // Don't mark as error if aborted
        if (message === "Upload cancelled") {
          return null;
        }

        updateFile(uploadFile.id, {
          status: "error",
          progress: 0,
          error: message,
        });

        return null;
      } finally {
        abortControllersRef.current.delete(uploadFile.id);
      }
    },
    [updateFile],
  );

  // Upload all pending files
  const uploadFiles = useCallback(
    async (options: UploadOptions = {}): Promise<UploadResult[]> => {
      const pendingFiles = files.filter((f) => f.status === "pending");

      if (pendingFiles.length === 0) {
        return [];
      }

      const results: UploadResult[] = [];

      // Upload files in parallel (with a limit of 3 concurrent uploads)
      const concurrencyLimit = 3;
      const chunks: UploadedFile[][] = [];

      for (let i = 0; i < pendingFiles.length; i += concurrencyLimit) {
        chunks.push(pendingFiles.slice(i, i + concurrencyLimit));
      }

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((file) => uploadSingleFile(file, options)),
        );

        for (const result of chunkResults) {
          if (result) {
            results.push(result);
          }
        }
      }

      return results;
    },
    [files, uploadSingleFile],
  );

  // Retry a failed upload
  const retryFile = useCallback(
    async (
      fileId: string,
      options: UploadOptions = {},
    ): Promise<UploadResult | null> => {
      const file = files.find((f) => f.id === fileId);
      if (!file || file.status !== "error") {
        return null;
      }

      // Reset file state
      updateFile(fileId, { status: "pending", progress: 0, error: undefined });

      return uploadSingleFile(file, options);
    },
    [files, updateFile, uploadSingleFile],
  );

  // Computed values
  const isUploading = files.some((f) => f.status === "uploading");

  const overallProgress =
    files.length > 0
      ? Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)
      : 0;

  const completedFiles = files.filter((f) => f.status === "complete");
  const errorFiles = files.filter((f) => f.status === "error");

  return {
    files,
    addFiles,
    uploadFiles,
    removeFile,
    clearFiles,
    retryFile,
    isUploading,
    overallProgress,
    completedFiles,
    errorFiles,
  };
}

export default useFileUpload;
