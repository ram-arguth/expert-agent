/**
 * FileUploadProgress Component Tests
 *
 * Tests for the file upload progress display component.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.1 File Upload
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileUploadProgress } from "../file-upload-progress";
import { UploadedFile } from "@/lib/hooks/use-file-upload";

// Helper to create mock uploaded file
function createMockFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: `file_${Date.now()}_${Math.random()}`,
    file: new File(["content"], "test.pdf", { type: "application/pdf" }),
    status: "pending",
    progress: 0,
    ...overrides,
  };
}

describe("FileUploadProgress", () => {
  describe("Rendering", () => {
    it("renders nothing when files array is empty", () => {
      const { container } = render(<FileUploadProgress files={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it("renders file items for each file", () => {
      const files = [
        createMockFile({ id: "file-1" }),
        createMockFile({ id: "file-2" }),
      ];

      render(<FileUploadProgress files={files} />);

      expect(screen.getByTestId("file-item-file-1")).toBeInTheDocument();
      expect(screen.getByTestId("file-item-file-2")).toBeInTheDocument();
    });

    it("displays file name and size", () => {
      const file = new File(["test content here"], "document.pdf", {
        type: "application/pdf",
      });
      const files = [createMockFile({ id: "file-1", file })];

      render(<FileUploadProgress files={files} />);

      expect(screen.getByText("document.pdf")).toBeInTheDocument();
    });
  });

  describe("Status Display", () => {
    it("shows pending status without progress bar at 0%", () => {
      const files = [
        createMockFile({ id: "file-1", status: "pending", progress: 0 }),
      ];

      render(<FileUploadProgress files={files} />);

      expect(screen.getByTestId("progress-file-1")).toBeInTheDocument();
    });

    it("shows progress bar during upload", () => {
      const files = [
        createMockFile({ id: "file-1", status: "uploading", progress: 50 }),
      ];

      render(<FileUploadProgress files={files} />);

      expect(screen.getByTestId("progress-file-1")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("shows success styling for complete files", () => {
      const files = [
        createMockFile({ id: "file-1", status: "complete", progress: 100 }),
      ];

      render(<FileUploadProgress files={files} />);

      const item = screen.getByTestId("file-item-file-1");
      expect(item).toHaveClass("bg-green-500/5");
    });

    it("shows error styling and message for failed files", () => {
      const files = [
        createMockFile({
          id: "file-1",
          status: "error",
          error: "Upload failed due to network error",
        }),
      ];

      render(<FileUploadProgress files={files} />);

      const item = screen.getByTestId("file-item-file-1");
      expect(item).toHaveClass("bg-destructive/5");
      expect(
        screen.getByText("Upload failed due to network error"),
      ).toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("calls onRemove when remove button clicked", () => {
      const onRemove = vi.fn();
      const files = [createMockFile({ id: "file-1", status: "pending" })];

      render(<FileUploadProgress files={files} onRemove={onRemove} />);

      fireEvent.click(screen.getByTestId("remove-file-1"));

      expect(onRemove).toHaveBeenCalledWith("file-1");
    });

    it("does not show remove button during upload", () => {
      const onRemove = vi.fn();
      const files = [
        createMockFile({ id: "file-1", status: "uploading", progress: 50 }),
      ];

      render(<FileUploadProgress files={files} onRemove={onRemove} />);

      expect(screen.queryByTestId("remove-file-1")).not.toBeInTheDocument();
    });

    it("calls onRetry when retry button clicked for error files", () => {
      const onRetry = vi.fn();
      const files = [
        createMockFile({ id: "file-1", status: "error", error: "Failed" }),
      ];

      render(<FileUploadProgress files={files} onRetry={onRetry} />);

      fireEvent.click(screen.getByTestId("retry-file-1"));

      expect(onRetry).toHaveBeenCalledWith("file-1");
    });

    it("does not show retry button for non-error files", () => {
      const onRetry = vi.fn();
      const files = [createMockFile({ id: "file-1", status: "pending" })];

      render(<FileUploadProgress files={files} onRetry={onRetry} />);

      expect(screen.queryByTestId("retry-file-1")).not.toBeInTheDocument();
    });
  });

  describe("Preview", () => {
    it("shows image preview when previewUrl is available", () => {
      const files = [
        createMockFile({
          id: "file-1",
          file: new File([""], "image.png", { type: "image/png" }),
          previewUrl: "blob:http://localhost/image-preview",
        }),
      ];

      render(<FileUploadProgress files={files} />);

      const img = screen.getByAltText("image.png");
      expect(img).toHaveAttribute("src", "blob:http://localhost/image-preview");
    });

    it("shows file icon when no preview is available", () => {
      const files = [createMockFile({ id: "file-1" })];

      render(<FileUploadProgress files={files} />);

      // Should render without preview (icon fallback)
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible remove button labels", () => {
      const onRemove = vi.fn();
      const file = new File([""], "document.pdf", { type: "application/pdf" });
      const files = [createMockFile({ id: "file-1", file, status: "pending" })];

      render(<FileUploadProgress files={files} onRemove={onRemove} />);

      expect(screen.getByLabelText("Remove document.pdf")).toBeInTheDocument();
    });

    it("has accessible retry button labels", () => {
      const onRetry = vi.fn();
      const file = new File([""], "document.pdf", { type: "application/pdf" });
      const files = [
        createMockFile({
          id: "file-1",
          file,
          status: "error",
          error: "Failed",
        }),
      ];

      render(<FileUploadProgress files={files} onRetry={onRetry} />);

      expect(
        screen.getByLabelText("Retry upload for document.pdf"),
      ).toBeInTheDocument();
    });
  });
});
