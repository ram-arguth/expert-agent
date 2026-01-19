import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

// Mock workspace context - default to personal workspace
const mockSwitchWorkspace = vi.fn();
const createMockWorkspace = (overrides = {}) => ({
  activeOrgId: null as string | null,
  activeOrg: null as {
    id: string;
    name: string;
    slug: string;
    type: string;
  } | null,
  organizations: [] as Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    role: string;
  }>,
  isLoading: false,
  switchWorkspace: mockSwitchWorkspace,
  hasRole: vi.fn(() => false),
  isPersonalContext: true,
  refresh: vi.fn(),
  ...overrides,
});

const mockUseWorkspace = vi.fn(() => createMockWorkspace());

vi.mock("@/lib/context/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default personal workspace
    mockUseWorkspace.mockReturnValue(createMockWorkspace());
  });

  it("renders with default navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Expert Agents")).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("shows organization items when showOrgItems is true", () => {
    render(<Sidebar showOrgItems />);
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });

  it("does not show organization items by default", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Organization")).not.toBeInTheDocument();
    expect(screen.queryByText("Billing")).not.toBeInTheDocument();
  });

  it("highlights the active navigation item", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveClass("bg-primary");
  });

  it("collapses when collapsed prop is true", () => {
    render(<Sidebar collapsed />);
    // When collapsed, text labels should not be visible
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("calls onToggle when collapse button is clicked", () => {
    const onToggle = vi.fn();
    render(<Sidebar onToggle={onToggle} />);
    const toggleButton = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    fireEvent.click(toggleButton);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows logo with Expert AI text", () => {
    render(<Sidebar />);
    expect(screen.getByText("Expert AI")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Sidebar className="custom-class" />);
    const sidebar = screen.getByTestId("sidebar");
    expect(sidebar).toHaveClass("custom-class");
  });

  describe("Workspace Indicator", () => {
    it("shows workspace indicator when authenticated", () => {
      render(<Sidebar />);
      expect(screen.getByTestId("workspace-indicator")).toBeInTheDocument();
    });

    it("shows Personal workspace by default", () => {
      render(<Sidebar />);
      expect(screen.getByText("Personal")).toBeInTheDocument();
      expect(screen.getByText("Workspace")).toBeInTheDocument();
    });

    it("shows organization name when org is active", () => {
      mockUseWorkspace.mockReturnValue(
        createMockWorkspace({
          activeOrgId: "org-123",
          activeOrg: {
            id: "org-123",
            name: "Acme Corp",
            slug: "acme",
            type: "TEAM",
          },
          organizations: [
            {
              id: "org-123",
              name: "Acme Corp",
              slug: "acme",
              type: "TEAM",
              role: "OWNER",
            },
          ],
          hasRole: vi.fn(() => true),
          isPersonalContext: false,
        }),
      );

      render(<Sidebar />);
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    it("shows collapsed workspace indicator when sidebar is collapsed", () => {
      render(<Sidebar collapsed />);
      // Should still have workspace indicator
      expect(screen.getByTestId("workspace-indicator")).toBeInTheDocument();
      // But should not show the full text
      expect(screen.queryByText("Personal")).not.toBeInTheDocument();
    });

    it("workspace button has accessible aria-label", () => {
      render(<Sidebar />);
      const button = screen.getByRole("button", {
        name: /current workspace: personal/i,
      });
      expect(button).toBeInTheDocument();
    });
  });
});
