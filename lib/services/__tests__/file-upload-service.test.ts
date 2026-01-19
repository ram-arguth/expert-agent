/**
 * File Upload Service Tests
 *
 * Tests for the client-side file upload service.
 * Mocks fetch and XMLHttpRequest for testing.
 *
 * @see lib/services/file-upload-service.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadFile,
  uploadFiles,
  extractFilesFromFormData,
} from "../file-upload-service";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
const mockXHRInstances: MockXHR[] = [];

class MockXHR {
  // Event listeners
  private loadListener: (() => void) | null = null;
  private errorListener: (() => void) | null = null;
  private progressListener:
    | ((e: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void)
    | null = null;

  // Response
  status = 200;

  // Upload property with event listeners
  upload = {
    addEventListener: (
      event: string,
      callback: (e: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void,
    ) => {
      if (event === "progress") {
        this.progressListener = callback;
      }
    },
  };

  addEventListener(event: string, callback: () => void) {
    if (event === "load") {
      this.loadListener = callback;
    } else if (event === "error") {
      this.errorListener = callback;
    }
  }

  open = vi.fn();
  setRequestHeader = vi.fn();

  send = vi.fn(() => {
    // Simulate progress
    if (this.progressListener) {
      this.progressListener({ lengthComputable: true, loaded: 50, total: 100 });
      this.progressListener({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      });
    }
    // Simulate completion
    setTimeout(() => {
      if (this.loadListener) {
        this.loadListener();
      }
    }, 0);
  });

  // Helper to simulate error
  simulateError() {
    if (this.errorListener) {
      this.errorListener();
    }
  }

  constructor() {
    mockXHRInstances.push(this);
  }
}

// Replace XMLHttpRequest globally
(global as unknown as { XMLHttpRequest: typeof MockXHR }).XMLHttpRequest =
  MockXHR;

describe("File Upload Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXHRInstances.length = 0;

    // Default mock for getSignedUploadUrl
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        uploadUrl: "https://storage.googleapis.com/bucket/file?signature=abc",
        gcsPath: "gs://bucket/uploads/file.pdf",
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadFile", () => {
    it("gets signed URL and uploads file", async () => {
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      const result = await uploadFile(file, "document", "ux-analyst", {});

      // Should call /api/upload
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test.pdf"),
        }),
      );

      // Should return file metadata
      expect(result).toEqual({
        fieldName: "document",
        gcsPath: "gs://bucket/uploads/file.pdf",
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12,
      });
    });

    it("reports upload progress", async () => {
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const progressCallback = vi.fn();

      await uploadFile(file, "document", "ux-analyst", {}, progressCallback);

      // Should have reported progress
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(100);
    });

    it("throws error when get signed URL fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Quota exceeded" }),
      });

      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      await expect(
        uploadFile(file, "document", "ux-analyst", {}),
      ).rejects.toThrow("Quota exceeded");
    });

    it("includes org headers in API request", async () => {
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });

      await uploadFile(file, "document", "ux-analyst", {
        "X-Active-Org": "org-123",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Active-Org": "org-123",
          }),
        }),
      );
    });
  });

  describe("uploadFiles", () => {
    it("uploads multiple files in parallel", async () => {
      const file1 = new File(["content1"], "doc1.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["content2"], "doc2.pdf", {
        type: "application/pdf",
      });

      const results = await uploadFiles(
        [
          { file: file1, fieldName: "primaryDoc" },
          { file: file2, fieldName: "supportingDoc" },
        ],
        "ux-analyst",
      );

      expect(results).toHaveLength(2);
      expect(results[0].fieldName).toBe("primaryDoc");
      expect(results[1].fieldName).toBe("supportingDoc");
    });

    it("returns empty array for no files", async () => {
      const results = await uploadFiles([], "ux-analyst");
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("reports progress for each file", async () => {
      const file1 = new File(["content1"], "doc1.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["content2"], "doc2.pdf", {
        type: "application/pdf",
      });
      const progressCallback = vi.fn();

      await uploadFiles(
        [
          { file: file1, fieldName: "doc1" },
          { file: file2, fieldName: "doc2" },
        ],
        "ux-analyst",
        {},
        progressCallback,
      );

      // Should have called progress callback
      expect(progressCallback).toHaveBeenCalled();

      // Last call should have both files complete
      const lastCall =
        progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filename: "doc1.pdf" }),
          expect.objectContaining({ filename: "doc2.pdf" }),
        ]),
      );
    });
  });

  describe("extractFilesFromFormData", () => {
    it("extracts single file", () => {
      const file = new File(["content"], "doc.pdf", {
        type: "application/pdf",
      });
      const formData = { document: file, text: "hello" };

      const result = extractFilesFromFormData(formData);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ file, fieldName: "document" });
    });

    it("extracts file arrays", () => {
      const file1 = new File(["content1"], "doc1.pdf", {
        type: "application/pdf",
      });
      const file2 = new File(["content2"], "doc2.pdf", {
        type: "application/pdf",
      });
      const formData = { documents: [file1, file2] };

      const result = extractFilesFromFormData(formData);

      expect(result).toHaveLength(2);
      expect(result[0].fieldName).toBe("documents[0]");
      expect(result[1].fieldName).toBe("documents[1]");
    });

    it("ignores non-file values", () => {
      const formData = { text: "hello", count: 5, tags: ["a", "b"] };

      const result = extractFilesFromFormData(formData);

      expect(result).toHaveLength(0);
    });

    it("handles mixed data", () => {
      const file = new File(["content"], "doc.pdf", {
        type: "application/pdf",
      });
      const formData = { document: file, title: "My Doc", tags: ["legal"] };

      const result = extractFilesFromFormData(formData);

      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe("document");
    });
  });
});
