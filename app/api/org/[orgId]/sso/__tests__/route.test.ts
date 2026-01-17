/**
 * SSO API Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 6.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    org: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

// Mock cedar
vi.mock("@/lib/authz/cedar", () => ({
  isAuthorized: vi.fn(),
  CedarActions: { ConfigureSSO: "ConfigureSSO" },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAuthorized } from "@/lib/authz/cedar";
import type { Mock } from "vitest";

const mockAuth = auth as Mock;
const mockFindUnique = prisma.membership.findUnique as Mock;
const mockOrgFindUnique = prisma.org.findUnique as Mock;
const mockOrgUpdate = prisma.org.update as Mock;
const mockIsAuthorized = isAuthorized as Mock;

describe("SSO API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockFindUnique.mockResolvedValue({
      userId: "user-1",
      orgId: "org-123",
      role: "OWNER",
    });
    mockIsAuthorized.mockReturnValue({ isAuthorized: true });
  });

  describe("GET /api/org/:orgId/sso", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET(new NextRequest("http://localhost"), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 403 for non-members", async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await GET(new NextRequest("http://localhost"), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(403);
    });

    it("returns org SSO config", async () => {
      mockOrgFindUnique.mockResolvedValue({
        id: "org-123",
        domain: "acme.com",
        domainVerified: true,
        verificationToken: "token-123",
        ssoConfig: { provider: "saml" },
        type: "ENTERPRISE",
      });

      const response = await GET(new NextRequest("http://localhost"), {
        params: Promise.resolve({ orgId: "org-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.domain).toBe("acme.com");
      expect(data.domainVerified).toBe(true);
      expect(data.isEnterprise).toBe(true);
    });
  });

  describe("POST /api/org/:orgId/sso", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const response = await POST(
        new NextRequest("http://localhost", {
          method: "POST",
          body: JSON.stringify({ provider: "saml" }),
        }),
        { params: Promise.resolve({ orgId: "org-123" }) },
      );

      expect(response.status).toBe(401);
    });

    it("returns 400 for invalid config", async () => {
      const response = await POST(
        new NextRequest("http://localhost", {
          method: "POST",
          body: JSON.stringify({ provider: "invalid" }),
        }),
        { params: Promise.resolve({ orgId: "org-123" }) },
      );

      expect(response.status).toBe(400);
    });

    it("saves SAML config", async () => {
      mockOrgUpdate.mockResolvedValue({
        id: "org-123",
        ssoConfig: { provider: "saml", entityId: "entity-1" },
        type: "ENTERPRISE",
      });

      const response = await POST(
        new NextRequest("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            provider: "saml",
            entityId: "entity-1",
            ssoUrl: "https://idp.example.com/sso",
          }),
        }),
        { params: Promise.resolve({ orgId: "org-123" }) },
      );

      expect(response.status).toBe(200);
      expect(mockOrgUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-123" },
          data: expect.objectContaining({
            type: "ENTERPRISE",
          }),
        }),
      );
    });

    it("saves OIDC config", async () => {
      mockOrgUpdate.mockResolvedValue({
        id: "org-123",
        ssoConfig: { provider: "oidc" },
        type: "ENTERPRISE",
      });

      const response = await POST(
        new NextRequest("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            provider: "oidc",
            clientId: "client-123",
            issuerUrl: "https://auth.example.com",
          }),
        }),
        { params: Promise.resolve({ orgId: "org-123" }) },
      );

      expect(response.status).toBe(200);
    });
  });
});
