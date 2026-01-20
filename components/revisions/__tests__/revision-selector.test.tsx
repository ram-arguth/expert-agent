/**
 * Revision Selector Component Tests
 *
 * Tests for revision history selection including:
 * - Version display
 * - Revision selection
 * - Hook functionality
 *
 * @see docs/IMPEMENTATION.md - Phase 4.5 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RevisionSelector,
  useRevisionState,
  Revision,
} from "../revision-selector";
import { renderHook, act } from "@testing-library/react";

describe("RevisionSelector", () => {
  // Sample revisions
  const mockRevisions: Revision[] = [
    {
      id: "rev-1",
      version: 1,
      createdAt: new Date(),
      source: "initial",
    },
    {
      id: "rev-2",
      version: 2,
      createdAt: new Date(),
      parentId: "rev-1",
      source: "chat",
      summary: "Added section on accessibility",
    },
    {
      id: "rev-3",
      version: 3,
      createdAt: new Date(),
      parentId: "rev-2",
      source: "edit",
      summary: "Fixed typos and formatting",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders version counter", () => {
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      expect(screen.getByTestId("revision-selector")).toBeInTheDocument();
      expect(screen.getByText(/Version 3 of 3/)).toBeInTheDocument();
    });

    it("returns null for empty revisions", () => {
      const { container } = render(
        <RevisionSelector revisions={[]} currentRevisionId="" />,
      );

      expect(container).toBeEmptyDOMElement();
    });

    it("shows simple label for single revision", () => {
      const singleRevision = [mockRevisions[0]];
      render(
        <RevisionSelector
          revisions={singleRevision}
          currentRevisionId="rev-1"
        />,
      );

      expect(screen.getByText("Version 1")).toBeInTheDocument();
      expect(screen.queryByTestId("revision-selector")).not.toBeInTheDocument();
    });
  });

  describe("Dropdown Menu", () => {
    it("opens dropdown on click", async () => {
      const user = userEvent.setup();
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(() => {
        expect(screen.getByText("Revision History")).toBeInTheDocument();
      });
    });

    it("shows all revisions in dropdown", async () => {
      const user = userEvent.setup();
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(() => {
        expect(screen.getByTestId("revision-item-1")).toBeInTheDocument();
        expect(screen.getByTestId("revision-item-2")).toBeInTheDocument();
        expect(screen.getByTestId("revision-item-3")).toBeInTheDocument();
      });
    });

    it("highlights current revision", async () => {
      const user = userEvent.setup();
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-2"
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(() => {
        const revItem = screen.getByTestId("revision-item-2");
        expect(revItem).toHaveClass("bg-primary/5");
      });
    });
  });

  describe("Revision Selection", () => {
    it("calls onSelectRevision when revision clicked", async () => {
      const user = userEvent.setup();
      const onSelectRevision = vi.fn();

      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
          onSelectRevision={onSelectRevision}
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(async () => {
        const revItem = screen.getByTestId("revision-item-1");
        await user.click(revItem);
      });

      expect(onSelectRevision).toHaveBeenCalledWith(
        expect.objectContaining({ id: "rev-1", version: 1 }),
      );
    });
  });

  describe("Source Labels", () => {
    it("shows source labels in dropdown", async () => {
      const user = userEvent.setup();
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(() => {
        expect(screen.getByText("Initial")).toBeInTheDocument();
        expect(screen.getByText("From chat")).toBeInTheDocument();
        expect(screen.getByText("Edited")).toBeInTheDocument();
      });
    });
  });

  describe("Compact Mode", () => {
    it("renders simpler list in compact mode", async () => {
      const user = userEvent.setup();
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
          compact
        />,
      );

      await user.click(screen.getByTestId("revision-selector"));

      await waitFor(() => {
        // In compact mode, should not show source labels
        expect(screen.queryByText("Initial")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper button role", () => {
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("has proper test IDs", () => {
      render(
        <RevisionSelector
          revisions={mockRevisions}
          currentRevisionId="rev-3"
        />,
      );

      expect(screen.getByTestId("revision-selector")).toBeInTheDocument();
    });
  });
});

describe("useRevisionState", () => {
  const revisions: Revision[] = [
    { id: "rev-1", version: 1, createdAt: new Date() },
    { id: "rev-2", version: 2, createdAt: new Date() },
    { id: "rev-3", version: 3, createdAt: new Date() },
  ];

  it("defaults to latest revision", () => {
    const { result } = renderHook(() => useRevisionState(revisions));

    expect(result.current.currentId).toBe("rev-3");
    expect(result.current.current?.version).toBe(3);
  });

  it("respects initial ID", () => {
    const { result } = renderHook(() => useRevisionState(revisions, "rev-1"));

    expect(result.current.currentId).toBe("rev-1");
    expect(result.current.current?.version).toBe(1);
  });

  it("identifies latest revision correctly", () => {
    const { result } = renderHook(() => useRevisionState(revisions, "rev-3"));

    expect(result.current.isLatest).toBe(true);
  });

  it("identifies non-latest revision", () => {
    const { result } = renderHook(() => useRevisionState(revisions, "rev-1"));

    expect(result.current.isLatest).toBe(false);
  });

  it("selectRevision updates current", () => {
    const { result } = renderHook(() => useRevisionState(revisions, "rev-3"));

    act(() => {
      result.current.selectRevision(revisions[0]);
    });

    expect(result.current.currentId).toBe("rev-1");
    expect(result.current.isLatest).toBe(false);
  });

  it("returns total revision count", () => {
    const { result } = renderHook(() => useRevisionState(revisions));

    expect(result.current.totalRevisions).toBe(3);
  });
});
