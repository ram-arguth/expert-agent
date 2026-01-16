/**
 * OmniConfirmDialog Component Tests
 *
 * Tests for the OmniAgent confirmation dialog.
 *
 * @see docs/IMPLEMENTATION.md - Phase 2.6 Confirmation UX
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  OmniConfirmDialog,
  ClassificationResult,
} from "../omni-confirm-dialog";

describe("OmniConfirmDialog", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const highConfidenceResult: ClassificationResult = {
    suggestedAgentId: "ux-analyst",
    agentName: "UX Analyst",
    confidence: 0.85,
    reasoning: "This appears to be a question about user experience design.",
    alternatives: [
      {
        agentId: "product-advisor",
        agentName: "Product Advisor",
        confidence: 0.6,
      },
    ],
  };

  const lowConfidenceResult: ClassificationResult = {
    suggestedAgentId: "legal-advisor",
    agentName: "Legal Advisor",
    confidence: 0.35,
    reasoning: "This might be a legal question, but confidence is low.",
    alternatives: [
      { agentId: "ux-analyst", agentName: "UX Analyst", confidence: 0.3 },
      {
        agentId: "finance-planner",
        agentName: "Finance Planner",
        confidence: 0.2,
      },
    ],
  };

  const noMatchResult: ClassificationResult = {
    suggestedAgentId: null,
    agentName: null,
    confidence: 0,
    reasoning: "",
    noMatchSuggestion: "We don't have an expert for cooking recipes.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders dialog when open", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="How do I improve my app's usability?"
          result={highConfidenceResult}
        />,
      );

      expect(screen.getByTestId("omni-confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText("OmniAI Suggestion")).toBeInTheDocument();
    });

    it("does not render dialog when closed", () => {
      render(
        <OmniConfirmDialog
          open={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      expect(
        screen.queryByTestId("omni-confirm-dialog"),
      ).not.toBeInTheDocument();
    });

    it("displays the user query", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="How do I improve my app's usability?"
          result={highConfidenceResult}
        />,
      );

      expect(
        screen.getByText(/How do I improve my app's usability/),
      ).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading state when isLoading is true", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={null}
          isLoading={true}
        />,
      );

      expect(screen.getByTestId("loading-state")).toBeInTheDocument();
      expect(screen.getByText(/analyzing your question/i)).toBeInTheDocument();
    });
  });

  describe("High Confidence Result", () => {
    it("displays suggested agent with high confidence badge", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      expect(screen.getByText("UX Analyst")).toBeInTheDocument();
      expect(screen.getByText("85% confident")).toBeInTheDocument();
    });

    it("displays reasoning", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      expect(
        screen.getByText(
          "This appears to be a question about user experience design.",
        ),
      ).toBeInTheDocument();
    });

    it("calls onConfirm with agentId when suggestion clicked", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      fireEvent.click(screen.getByTestId("main-suggestion"));

      expect(mockOnConfirm).toHaveBeenCalledWith("ux-analyst");
    });

    it("calls onConfirm when confirm button clicked", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      fireEvent.click(screen.getByTestId("confirm-button"));

      expect(mockOnConfirm).toHaveBeenCalledWith("ux-analyst");
    });
  });

  describe("Low Confidence Result", () => {
    it("shows low confidence warning", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={lowConfidenceResult}
        />,
      );

      expect(screen.getByText(/low confidence match/i)).toBeInTheDocument();
    });

    it("displays alternatives section", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={lowConfidenceResult}
        />,
      );

      expect(screen.getByTestId("alternatives-section")).toBeInTheDocument();
      expect(screen.getByText("UX Analyst")).toBeInTheDocument();
      expect(screen.getByText("Finance Planner")).toBeInTheDocument();
    });

    it("calls onConfirm with alternative agentId when alternative clicked", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={lowConfidenceResult}
        />,
      );

      fireEvent.click(screen.getByTestId("alternative-ux-analyst"));

      expect(mockOnConfirm).toHaveBeenCalledWith("ux-analyst");
    });
  });

  describe("No Match Result", () => {
    it("shows no match state", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={noMatchResult}
        />,
      );

      expect(screen.getByTestId("no-match-state")).toBeInTheDocument();
      expect(screen.getByText(/no suitable expert found/i)).toBeInTheDocument();
    });

    it("displays custom noMatchSuggestion", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={noMatchResult}
        />,
      );

      expect(
        screen.getByText(/We don't have an expert for cooking recipes/),
      ).toBeInTheDocument();
    });

    it("does not show confirm button when no match", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={noMatchResult}
        />,
      );

      expect(screen.queryByTestId("confirm-button")).not.toBeInTheDocument();
    });
  });

  describe("User Actions", () => {
    it("calls onClose when cancel button clicked", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      fireEvent.click(screen.getByTestId("cancel-button"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("handles keyboard navigation on main suggestion", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      const suggestion = screen.getByTestId("main-suggestion");
      fireEvent.keyDown(suggestion, { key: "Enter" });

      expect(mockOnConfirm).toHaveBeenCalledWith("ux-analyst");
    });

    it("handles keyboard navigation on alternatives", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={lowConfidenceResult}
        />,
      );

      const alternative = screen.getByTestId("alternative-finance-planner");
      fireEvent.keyDown(alternative, { key: "Enter" });

      expect(mockOnConfirm).toHaveBeenCalledWith("finance-planner");
    });
  });

  describe("Accessibility", () => {
    it("has accessible dialog structure", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("suggestions have button role and tabindex", () => {
      render(
        <OmniConfirmDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          query="Test query"
          result={highConfidenceResult}
        />,
      );

      const suggestion = screen.getByTestId("main-suggestion");
      expect(suggestion).toHaveAttribute("role", "button");
      expect(suggestion).toHaveAttribute("tabindex", "0");
    });
  });
});
