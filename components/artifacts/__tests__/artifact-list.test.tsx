/**
 * Artifact List Component Tests
 *
 * Tests for the artifact list with favorites and filtering.
 *
 * @see components/artifacts/artifact-list.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtifactList, Artifact } from "../artifact-list";

describe("ArtifactList", () => {
  const mockArtifacts: Artifact[] = [
    {
      id: "artifact-1",
      title: "Contract Analysis Report",
      agentName: "Legal Advisor",
      agentId: "legal-advisor",
      createdAt: new Date("2026-01-15"),
      updatedAt: new Date("2026-01-18"),
      isFavorite: true,
      isShared: false,
      preview: "Analysis of employment contract terms...",
    },
    {
      id: "artifact-2",
      title: "UX Audit Results",
      agentName: "UX Analyst",
      agentId: "ux-analyst",
      createdAt: new Date("2026-01-10"),
      updatedAt: new Date("2026-01-12"),
      isFavorite: false,
      isShared: true,
      sharedBy: "Alice",
      preview: "Homepage accessibility issues found...",
    },
    {
      id: "artifact-3",
      title: "Financial Summary",
      agentName: "Financial Analyst",
      agentId: "financial-analyst",
      createdAt: new Date("2026-01-05"),
      updatedAt: new Date("2026-01-08"),
      isFavorite: false,
      isShared: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders list of artifacts", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(screen.getByText("Contract Analysis Report")).toBeInTheDocument();
      expect(screen.getByText("UX Audit Results")).toBeInTheDocument();
      expect(screen.getByText("Financial Summary")).toBeInTheDocument();
    });

    it("shows agent name badge for each artifact", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(screen.getByText("Legal Advisor")).toBeInTheDocument();
      expect(screen.getByText("UX Analyst")).toBeInTheDocument();
      expect(screen.getByText("Financial Analyst")).toBeInTheDocument();
    });

    it("shows preview text when available", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(
        screen.getByText(/Analysis of employment contract/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Homepage accessibility issues/),
      ).toBeInTheDocument();
    });

    it("shows shared indicator for shared artifacts", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(screen.getByText("by Alice")).toBeInTheDocument();
    });
  });

  describe("Favorites", () => {
    it("shows favorite icon for pinned items", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      const favoriteButton = screen.getByTestId("favorite-toggle-artifact-1");
      expect(favoriteButton.querySelector("svg")).toHaveClass(
        "fill-yellow-400",
      );
    });

    it("clicking favorite toggles pin state", async () => {
      const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ArtifactList
          artifacts={mockArtifacts}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      const favoriteButton = screen.getByTestId("favorite-toggle-artifact-2");
      await user.click(favoriteButton);

      expect(onToggleFavorite).toHaveBeenCalledWith("artifact-2", true);
    });

    it("unfavorite toggles pin state off", async () => {
      const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ArtifactList
          artifacts={mockArtifacts}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      const favoriteButton = screen.getByTestId("favorite-toggle-artifact-1");
      await user.click(favoriteButton);

      expect(onToggleFavorite).toHaveBeenCalledWith("artifact-1", false);
    });

    it("shows loading state while toggling favorite", async () => {
      const onToggleFavorite = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100)),
        );
      const user = userEvent.setup();

      render(
        <ArtifactList
          artifacts={mockArtifacts}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      const favoriteButton = screen.getByTestId("favorite-toggle-artifact-2");
      await user.click(favoriteButton);

      // Should show loading spinner
      expect(favoriteButton.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("defaults to all filter", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(screen.getByTestId("filter-all")).toHaveAttribute(
        "data-state",
        "active",
      );
    });

    it("filters by favorites", async () => {
      const user = userEvent.setup();
      render(<ArtifactList artifacts={mockArtifacts} />);

      await user.click(screen.getByTestId("filter-favorites"));

      expect(screen.getByText("Contract Analysis Report")).toBeInTheDocument();
      expect(screen.queryByText("UX Audit Results")).not.toBeInTheDocument();
      expect(screen.queryByText("Financial Summary")).not.toBeInTheDocument();
    });

    it("filters by shared", async () => {
      const user = userEvent.setup();
      render(<ArtifactList artifacts={mockArtifacts} />);

      await user.click(screen.getByTestId("filter-shared"));

      expect(
        screen.queryByText("Contract Analysis Report"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("UX Audit Results")).toBeInTheDocument();
      expect(screen.queryByText("Financial Summary")).not.toBeInTheDocument();
    });

    it("filters by recent and sorts by date", async () => {
      const user = userEvent.setup();
      render(<ArtifactList artifacts={mockArtifacts} />);

      await user.click(screen.getByTestId("filter-recent"));

      // All should be visible, sorted by updatedAt
      const cards = screen.getAllByTestId(/artifact-card-/);
      expect(cards).toHaveLength(3);
    });

    it("shows empty state when no artifacts match filter", async () => {
      const user = userEvent.setup();
      const artifactsNoFavorites = mockArtifacts.map((a) => ({
        ...a,
        isFavorite: false,
      }));

      render(<ArtifactList artifacts={artifactsNoFavorites} />);

      await user.click(screen.getByTestId("filter-favorites"));

      expect(screen.getByText("No artifacts found")).toBeInTheDocument();
      expect(screen.getByText("View all artifacts")).toBeInTheDocument();
    });

    it("can reset filter from empty state", async () => {
      const user = userEvent.setup();
      const artifactsNoFavorites = mockArtifacts.map((a) => ({
        ...a,
        isFavorite: false,
      }));

      render(<ArtifactList artifacts={artifactsNoFavorites} />);

      await user.click(screen.getByTestId("filter-favorites"));
      await user.click(screen.getByText("View all artifacts"));

      expect(screen.getByText("Contract Analysis Report")).toBeInTheDocument();
    });
  });

  describe("Loading and Error States", () => {
    it("shows loading indicator when loading", () => {
      render(<ArtifactList artifacts={[]} isLoading={true} />);

      expect(screen.getByTestId("artifact-list-loading")).toBeInTheDocument();
    });

    it("shows error message when error", () => {
      render(<ArtifactList artifacts={[]} error="Failed to load artifacts" />);

      expect(screen.getByText("Failed to load artifacts")).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("calls onArtifactClick when artifact card clicked", async () => {
      const onArtifactClick = vi.fn();
      const user = userEvent.setup();

      render(
        <ArtifactList
          artifacts={mockArtifacts}
          onArtifactClick={onArtifactClick}
        />,
      );

      await user.click(screen.getByTestId("artifact-card-artifact-1"));

      expect(onArtifactClick).toHaveBeenCalledWith(mockArtifacts[0]);
    });

    it("does not propagate click when clicking favorite button", async () => {
      const onArtifactClick = vi.fn();
      const onToggleFavorite = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();

      render(
        <ArtifactList
          artifacts={mockArtifacts}
          onArtifactClick={onArtifactClick}
          onToggleFavorite={onToggleFavorite}
        />,
      );

      await user.click(screen.getByTestId("favorite-toggle-artifact-1"));

      expect(onToggleFavorite).toHaveBeenCalled();
      expect(onArtifactClick).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("favorite button has accessible label", () => {
      render(<ArtifactList artifacts={mockArtifacts} />);

      expect(
        screen.getByLabelText("Remove from favorites"),
      ).toBeInTheDocument();
      expect(screen.getAllByLabelText("Add to favorites")).toHaveLength(2);
    });

    it("artifact cards are focusable", () => {
      render(
        <ArtifactList artifacts={mockArtifacts} onArtifactClick={vi.fn()} />,
      );

      const cards = screen.getAllByTestId(/artifact-card-/);
      cards.forEach((card) => {
        expect(card).toHaveClass("cursor-pointer");
      });
    });
  });
});
