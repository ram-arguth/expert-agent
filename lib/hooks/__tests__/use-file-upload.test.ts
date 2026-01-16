/**
 * useFileUpload Hook Tests
 *
 * Tests for the file upload hook.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.1 File Upload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFileUpload, UploadedFile } from "../use-file-upload";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
const mockXHR = {
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  upload: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  abort: vi.fn(),
  status: 200,
};

const originalXHR = global.XMLHttpRequest;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset XHR mock
  mockXHR.open.mockClear();
  mockXHR.send.mockClear();
  mockXHR.setRequestHeader.mockClear();
  mockXHR.upload.addEventListener.mockClear();
  mockXHR.addEventListener.mockClear();
  mockXHR.abort.mockClear();
  mockXHR.status = 200;

  // @ts-expect-error - mocking XMLHttpRequest
  global.XMLHttpRequest = vi.fn(() => mockXHR);
});

afterEach(() => {
  global.XMLHttpRequest = originalXHR;
});

// Helper to create a mock file
function createMockFile(name = "test.pdf", size = 1024): File {
  return new File(["test content"], name, { type: "application/pdf" });
}

// Helper to create an UploadedFile
function createUploadedFile(
  overrides: Partial<UploadedFile> = {},
): UploadedFile {
  return {
    id: `file_${Date.now()}`,
    file: createMockFile(),
    status: "pending",
    progress: 0,
    ...overrides,
  };
}

describe("useFileUpload", () => {
  describe("Initial State", () => {
    it("starts with empty files array", () => {
      const { result } = renderHook(() => useFileUpload());

      expect(result.current.files).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.overallProgress).toBe(0);
    });

    it("starts with no completed or error files", () => {
      const { result } = renderHook(() => useFileUpload());

      expect(result.current.completedFiles).toEqual([]);
      expect(result.current.errorFiles).toEqual([]);
    });
  });

  describe("addFiles", () => {
    it("adds files to the queue", () => {
      const { result } = renderHook(() => useFileUpload());
      const file = createUploadedFile({ id: "test-1" });

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].id).toBe("test-1");
    });

    it("can add multiple files", () => {
      const { result } = renderHook(() => useFileUpload());
      const files = [
        createUploadedFile({ id: "test-1" }),
        createUploadedFile({ id: "test-2" }),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.files).toHaveLength(2);
    });

    it("appends to existing files", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([createUploadedFile({ id: "test-1" })]);
      });

      act(() => {
        result.current.addFiles([createUploadedFile({ id: "test-2" })]);
      });

      expect(result.current.files).toHaveLength(2);
    });
  });

  describe("removeFile", () => {
    it("removes a file by ID", () => {
      const { result } = renderHook(() => useFileUpload());
      const files = [
        createUploadedFile({ id: "test-1" }),
        createUploadedFile({ id: "test-2" }),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      act(() => {
        result.current.removeFile("test-1");
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].id).toBe("test-2");
    });

    it("does nothing if file ID not found", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([createUploadedFile({ id: "test-1" })]);
      });

      act(() => {
        result.current.removeFile("nonexistent");
      });

      expect(result.current.files).toHaveLength(1);
    });
  });

  describe("clearFiles", () => {
    it("removes all files", () => {
      const { result } = renderHook(() => useFileUpload());
      const files = [
        createUploadedFile({ id: "test-1" }),
        createUploadedFile({ id: "test-2" }),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe("uploadFiles", () => {
    it("returns empty array when no pending files", async () => {
      const { result } = renderHook(() => useFileUpload());

      let uploadResult: Awaited<ReturnType<typeof result.current.uploadFiles>>;
      await act(async () => {
        uploadResult = await result.current.uploadFiles();
      });

      expect(uploadResult!).toEqual([]);
    });

    it("requests signed URL from API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            uploadUrl: "https://storage.googleapis.com/test",
            gcsPath: "uploads/test.pdf",
            fileId: "file-123",
          }),
      });

      // Simulate XHR completing
      mockXHR.addEventListener.mockImplementation(
        (event: string, handler: () => void) => {
          if (event === "load") {
            setTimeout(() => handler(), 10);
          }
        },
      );

      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([createUploadedFile({ id: "test-1" })]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("handles API error gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Invalid file type" }),
      });

      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([createUploadedFile({ id: "test-1" })]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      await waitFor(() => {
        expect(result.current.errorFiles).toHaveLength(1);
      });

      expect(result.current.errorFiles[0].error).toBe("Invalid file type");
    });
  });

  describe("Computed Values", () => {
    it("calculates overall progress correctly", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([
          createUploadedFile({ id: "test-1", progress: 50 }),
          createUploadedFile({ id: "test-2", progress: 100 }),
        ]);
      });

      expect(result.current.overallProgress).toBe(75);
    });

    it("identifies completed files", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([
          createUploadedFile({ id: "test-1", status: "complete" }),
          createUploadedFile({ id: "test-2", status: "pending" }),
        ]);
      });

      expect(result.current.completedFiles).toHaveLength(1);
      expect(result.current.completedFiles[0].id).toBe("test-1");
    });

    it("identifies error files", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([
          createUploadedFile({
            id: "test-1",
            status: "error",
            error: "Failed",
          }),
          createUploadedFile({ id: "test-2", status: "pending" }),
        ]);
      });

      expect(result.current.errorFiles).toHaveLength(1);
      expect(result.current.errorFiles[0].id).toBe("test-1");
    });

    it("tracks uploading state", () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([
          createUploadedFile({ id: "test-1", status: "uploading" }),
        ]);
      });

      expect(result.current.isUploading).toBe(true);
    });
  });

  describe("retryFile", () => {
    it("returns null if file not found", async () => {
      const { result } = renderHook(() => useFileUpload());

      let retryResult: Awaited<ReturnType<typeof result.current.retryFile>>;
      await act(async () => {
        retryResult = await result.current.retryFile("nonexistent");
      });

      expect(retryResult!).toBeNull();
    });

    it("returns null if file is not in error state", async () => {
      const { result } = renderHook(() => useFileUpload());

      act(() => {
        result.current.addFiles([
          createUploadedFile({ id: "test-1", status: "pending" }),
        ]);
      });

      let retryResult: Awaited<ReturnType<typeof result.current.retryFile>>;
      await act(async () => {
        retryResult = await result.current.retryFile("test-1");
      });

      expect(retryResult!).toBeNull();
    });
  });
});
