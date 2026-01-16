"use client";

/**
 * Context Files Tab Component
 *
 * Admin interface for managing organization context files.
 * Context files are documents that can be automatically included
 * in agent prompts for all queries made within the organization.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.2 Org Context Files
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Trash2,
  Upload,
  Loader2,
  AlertCircle,
  File,
  Lock,
} from "lucide-react";
import { useWorkspace } from "@/lib/context/workspace-context";
import { formatFileSize } from "@/components/upload/file-uploader";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface ContextFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  agentIds: string[];
  createdAt: string;
  uploadedById: string;
}

interface ContextFilesResponse {
  files: ContextFile[];
  count: number;
  limit: number;
  remaining: number;
}

// =============================================================================
// API Functions
// =============================================================================

async function fetchContextFiles(orgId: string): Promise<ContextFilesResponse> {
  const response = await fetch(`/api/org/${orgId}/context`);
  if (!response.ok) {
    throw new Error("Failed to fetch context files");
  }
  return response.json();
}

async function deleteContextFile(orgId: string, fileId: string): Promise<void> {
  const response = await fetch(`/api/org/${orgId}/context/${fileId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Failed to delete file");
  }
}

async function requestUploadUrl(
  orgId: string,
  file: File,
): Promise<{ uploadUrl: string; fileId: string; gcsPath: string }> {
  const response = await fetch(`/api/org/${orgId}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || "Failed to get upload URL");
  }
  return response.json();
}

// =============================================================================
// File Type Icon
// =============================================================================

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  // Different icons based on type
  const iconClass = "h-5 w-5";

  if (mimeType.includes("pdf")) {
    return <FileText className={cn(iconClass, "text-red-500")} />;
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return <FileText className={cn(iconClass, "text-blue-500")} />;
  }
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
    return <FileText className={cn(iconClass, "text-green-500")} />;
  }
  if (mimeType.includes("json")) {
    return <File className={cn(iconClass, "text-yellow-500")} />;
  }
  return <FileText className={cn(iconClass, "text-muted-foreground")} />;
}

// =============================================================================
// Context Files Tab Component
// =============================================================================

export function ContextFilesTab() {
  const { activeOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(
    null,
  );
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const isAdmin = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  // Fetch context files
  const {
    data: contextData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contextFiles", activeOrg?.id],
    queryFn: () => fetchContextFiles(activeOrg!.id),
    enabled: !!activeOrg?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteContextFile(activeOrg!.id, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["contextFiles", activeOrg?.id],
      });
    },
  });

  // Handle file selection
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !activeOrg?.id) return;

    setUploadError(null);
    setUploadProgress(0);

    try {
      // Get signed upload URL
      setUploadProgress(10);
      const { uploadUrl } = await requestUploadUrl(activeOrg.id, file);

      // Upload to GCS
      setUploadProgress(30);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = 30 + Math.round((e.loaded / e.total) * 60);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setUploadProgress(100);

      // Refresh file list
      await queryClient.invalidateQueries({
        queryKey: ["contextFiles", activeOrg.id],
      });

      // Reset after short delay
      setTimeout(() => {
        setUploadProgress(null);
      }, 1000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadProgress(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle delete
  const handleDelete = (fileId: string, fileName: string) => {
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      deleteMutation.mutate(fileId);
    }
  };

  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Select an organization to manage context files
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Context Files</CardTitle>
            <CardDescription>
              Upload documents that will be automatically included in agent
              prompts for all queries in this organization.
            </CardDescription>
          </div>
          {isAdmin && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.json"
                onChange={handleFileSelect}
                data-testid="context-file-input"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  uploadProgress !== null || (contextData?.remaining ?? 0) <= 0
                }
              >
                {uploadProgress !== null ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Upload Progress */}
        {uploadProgress !== null && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-muted-foreground text-sm">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}

        {/* Upload Error */}
        {uploadError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{uploadError}</span>
          </div>
        )}

        {/* File Limit Info */}
        {contextData && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {contextData.count} of {contextData.limit} files used
            </span>
            {contextData.remaining === 0 && (
              <Badge variant="destructive">Limit reached</Badge>
            )}
          </div>
        )}

        <Separator />

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-muted-foreground">
              Failed to load context files
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && contextData?.files.length === 0 && (
          <div className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-2 font-medium">No context files</p>
            <p className="text-muted-foreground text-sm">
              {isAdmin
                ? "Upload documents to include in agent prompts"
                : "No context files have been uploaded yet"}
            </p>
          </div>
        )}

        {/* File List */}
        {!isLoading && contextData && contextData.files.length > 0 && (
          <div className="space-y-3">
            {contextData.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border p-4"
                data-testid={`context-file-${file.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileTypeIcon mimeType={file.mimeType} />
                  </div>
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <span>•</span>
                      <span>
                        {new Date(file.createdAt).toLocaleDateString()}
                      </span>
                      {file.agentIds.length > 0 && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            {file.agentIds.length} agent
                            {file.agentIds.length !== 1 && "s"}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file.id, file.name)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete ${file.name}`}
                    data-testid={`delete-${file.id}`}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Admin Notice */}
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">
            Only organization owners and admins can upload or delete context
            files.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ContextFilesTab;
