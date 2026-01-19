/**
 * File Upload Service
 *
 * Client-side service for uploading files to GCS via signed URLs.
 * Part of Phase 4.2: Submit Handler implementation.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.2
 */

interface UploadedFile {
  fieldName: string;
  gcsPath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

/**
 * Get a signed upload URL from the API
 */
async function getSignedUploadUrl(
  filename: string,
  mimeType: string,
  agentId: string,
  orgHeaders: Record<string, string> = {},
): Promise<{ uploadUrl: string; gcsPath: string }> {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...orgHeaders,
    },
    body: JSON.stringify({
      filename,
      mimeType,
      agentId,
    }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || "Failed to get upload URL");
  }

  return response.json();
}

/**
 * Upload a file to GCS using a signed URL
 */
async function uploadToGCS(
  file: File,
  uploadUrl: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
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
      reject(new Error("Upload failed: Network error"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.send(file);
  });
}

/**
 * Upload a single file and return its metadata
 */
export async function uploadFile(
  file: File,
  fieldName: string,
  agentId: string,
  orgHeaders: Record<string, string> = {},
  onProgress?: (progress: number) => void,
): Promise<UploadedFile> {
  // 1. Get signed URL
  const { uploadUrl, gcsPath } = await getSignedUploadUrl(
    file.name,
    file.type || "application/octet-stream",
    agentId,
    orgHeaders,
  );

  // 2. Upload to GCS
  await uploadToGCS(file, uploadUrl, onProgress);

  // 3. Return file metadata
  return {
    fieldName,
    gcsPath,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

/**
 * Upload multiple files in parallel
 */
export async function uploadFiles(
  files: Array<{ file: File; fieldName: string }>,
  agentId: string,
  orgHeaders: Record<string, string> = {},
  onProgress?: (statuses: UploadProgress[]) => void,
): Promise<UploadedFile[]> {
  if (files.length === 0) {
    return [];
  }

  const statuses: UploadProgress[] = files.map(({ file }) => ({
    filename: file.name,
    progress: 0,
    status: "pending",
  }));

  const updateProgress = (index: number, update: Partial<UploadProgress>) => {
    statuses[index] = { ...statuses[index], ...update };
    onProgress?.([...statuses]);
  };

  // Upload all files in parallel
  const uploadPromises = files.map(async ({ file, fieldName }, index) => {
    try {
      updateProgress(index, { status: "uploading" });

      const result = await uploadFile(
        file,
        fieldName,
        agentId,
        orgHeaders,
        (progress) => updateProgress(index, { progress }),
      );

      updateProgress(index, { status: "complete", progress: 100 });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      updateProgress(index, { status: "error", error: errorMessage });
      throw error;
    }
  });

  return Promise.all(uploadPromises);
}

/**
 * Extract files from form data for upload
 */
export function extractFilesFromFormData(
  formData: Record<string, unknown>,
): Array<{ file: File; fieldName: string }> {
  const files: Array<{ file: File; fieldName: string }> = [];

  for (const [fieldName, value] of Object.entries(formData)) {
    if (value instanceof File) {
      files.push({ file: value, fieldName });
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item instanceof File) {
          files.push({ file: item, fieldName: `${fieldName}[${index}]` });
        }
      });
    }
  }

  return files;
}

export type { UploadedFile, UploadProgress };
