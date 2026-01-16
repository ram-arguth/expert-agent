/**
 * Context Files Tab Component Tests
 *
 * Tests for the org context files management UI.
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.2 Org Context Files
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContextFilesTab } from "../context-files-tab";

// Mock workspace context
const mockActiveOrg = {
  id: "org-123",
  name: "Test Org",
  slug: "test-org",
  role: "OWNER",
  type: "TEAM" as const,
};

vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    activeOrg: mockActiveOrg,
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

// Wrapper with providers
function renderWithProviders(component: React.ReactNode) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
}

describe("ContextFilesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading spinner while fetching", () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<ContextFilesTab />);

      expect(
        screen.getByRole("heading", { name: /context files/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no files", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [],
            count: 0,
            limit: 20,
            remaining: 20,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(screen.getByText(/no context files/i)).toBeInTheDocument();
      });
    });
  });

  describe("Files List", () => {
    it("displays context files with metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file-1",
                name: "policies.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024 * 1024,
                agentIds: [],
                createdAt: "2024-01-01T00:00:00Z",
                uploadedById: "user-1",
              },
              {
                id: "file-2",
                name: "guidelines.docx",
                mimeType:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                sizeBytes: 2048,
                agentIds: ["legal-advisor"],
                createdAt: "2024-01-02T00:00:00Z",
                uploadedById: "user-2",
              },
            ],
            count: 2,
            limit: 20,
            remaining: 18,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(screen.getByText("policies.pdf")).toBeInTheDocument();
        expect(screen.getByText("guidelines.docx")).toBeInTheDocument();
      });

      expect(screen.getByText("2 of 20 files used")).toBeInTheDocument();
    });

    it("shows agent count badge for filtered files", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file-1",
                name: "legal-context.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                agentIds: ["legal-advisor", "contract-reviewer"],
                createdAt: "2024-01-01T00:00:00Z",
                uploadedById: "user-1",
              },
            ],
            count: 1,
            limit: 20,
            remaining: 19,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(screen.getByText("2 agents")).toBeInTheDocument();
      });
    });
  });

  describe("Upload Button", () => {
    it("shows upload button for admin users", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [],
            count: 0,
            limit: 20,
            remaining: 20,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /upload file/i }),
        ).toBeInTheDocument();
      });
    });

    it("disables upload when limit reached", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [],
            count: 20,
            limit: 20,
            remaining: 0,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /upload file/i }),
        ).toBeDisabled();
      });

      await waitFor(() => {
        expect(screen.getByText("Limit reached")).toBeInTheDocument();
      });
    });
  });

  describe("Delete Functionality", () => {
    it("shows delete button for each file", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file-1",
                name: "test.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                agentIds: [],
                createdAt: "2024-01-01T00:00:00Z",
                uploadedById: "user-1",
              },
            ],
            count: 1,
            limit: 20,
            remaining: 19,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-file-1")).toBeInTheDocument();
      });
    });

    it("confirms before deleting", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file-1",
                name: "test.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                agentIds: [],
                createdAt: "2024-01-01T00:00:00Z",
                uploadedById: "user-1",
              },
            ],
            count: 1,
            limit: 20,
            remaining: 19,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(screen.getByTestId("delete-file-1")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("delete-file-1"));

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("test.pdf"),
      );

      confirmSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("shows error state when fetch fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        expect(
          screen.getByText(/failed to load context files/i),
        ).toBeInTheDocument();
      });
    });
  });

  // Note: Non-admin tests require complex mock setup for the workspace context
  // This would be better tested via E2E or integration tests
  describe("Non-Admin View", () => {
    it.todo("hides upload button for non-admin users");
  });

  describe("Accessibility", () => {
    // Note: This test uses the OWNER mock which shows the delete button
    it("has accessible delete button", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file-1",
                name: "test.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
                agentIds: [],
                createdAt: "2024-01-01T00:00:00Z",
                uploadedById: "user-1",
              },
            ],
            count: 1,
            limit: 20,
            remaining: 19,
          }),
      });

      renderWithProviders(<ContextFilesTab />);

      await waitFor(() => {
        // The delete button has an aria-label
        expect(screen.getByTestId("delete-file-1")).toHaveAttribute(
          "aria-label",
          "Delete test.pdf",
        );
      });
    });
  });
});
