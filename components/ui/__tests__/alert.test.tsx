/**
 * Alert Component Tests
 *
 * Tests for the Alert UI component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert, AlertTitle, AlertDescription } from "../alert";

describe("Alert Component", () => {
  describe("Alert", () => {
    it("renders with default variant", () => {
      render(<Alert data-testid="alert">Test content</Alert>);

      const alert = screen.getByTestId("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveRole("alert");
    });

    it("renders with destructive variant", () => {
      render(
        <Alert variant="destructive" data-testid="alert">
          Error content
        </Alert>,
      );

      const alert = screen.getByTestId("alert");
      expect(alert).toHaveClass("text-destructive");
    });

    it("applies custom className", () => {
      render(
        <Alert className="custom-class" data-testid="alert">
          Content
        </Alert>,
      );

      expect(screen.getByTestId("alert")).toHaveClass("custom-class");
    });
  });

  describe("AlertTitle", () => {
    it("renders title text", () => {
      render(<AlertTitle>Alert Title</AlertTitle>);

      expect(screen.getByRole("heading")).toHaveTextContent("Alert Title");
    });

    it("applies custom className", () => {
      render(<AlertTitle className="title-class">Title</AlertTitle>);

      expect(screen.getByRole("heading")).toHaveClass("title-class");
    });
  });

  describe("AlertDescription", () => {
    it("renders description text", () => {
      render(<AlertDescription>Description text</AlertDescription>);

      expect(screen.getByText("Description text")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <AlertDescription className="desc-class" data-testid="desc">
          Description
        </AlertDescription>,
      );

      expect(screen.getByTestId("desc")).toHaveClass("desc-class");
    });
  });

  describe("Integration", () => {
    it("renders full alert with title and description", () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong</AlertDescription>
        </Alert>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("heading")).toHaveTextContent("Error");
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("supports icons in alert", () => {
      render(
        <Alert>
          <svg data-testid="icon" />
          <AlertTitle>Info</AlertTitle>
          <AlertDescription>Information message</AlertDescription>
        </Alert>,
      );

      expect(screen.getByTestId("icon")).toBeInTheDocument();
      expect(screen.getByRole("heading")).toHaveTextContent("Info");
    });
  });
});
