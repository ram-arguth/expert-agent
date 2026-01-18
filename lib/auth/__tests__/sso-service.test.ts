/**
 * SSO Service Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 1.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkEmailDomainForSSO,
  buildSAMLAuthUrl,
  buildOIDCAuthUrl,
  handleSAMLCallback,
} from "../sso-service";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    org: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock openid-client
vi.mock("openid-client", () => ({
  discovery: vi.fn().mockResolvedValue({}),
  buildAuthorizationUrl: vi
    .fn()
    .mockReturnValue(new URL("https://idp.example.com/authorize?state=xyz")),
  authorizationCodeGrant: vi.fn(),
}));

import { prisma } from "@/lib/db";
import type { Mock } from "vitest";

const mockFindFirst = prisma.org.findFirst as Mock;
const mockFindUnique = prisma.org.findUnique as Mock;

describe("SSO Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://ai.oz.ly";
  });

  describe("checkEmailDomainForSSO", () => {
    it("returns shouldRedirect=false for invalid email", async () => {
      const result = await checkEmailDomainForSSO("invalidemail");
      expect(result.shouldRedirect).toBe(false);
      expect(result.error).toBe("Invalid email format");
    });

    it("returns shouldRedirect=false for email without domain part", async () => {
      const result = await checkEmailDomainForSSO("user@");
      expect(result.shouldRedirect).toBe(false);
    });

    it("returns shouldRedirect=false when no matching org found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await checkEmailDomainForSSO("user@example.com");

      expect(result.shouldRedirect).toBe(false);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: "example.com",
            domainVerified: true,
          }),
        }),
      );
    });

    it("returns shouldRedirect=false when org has no ssoConfig", async () => {
      mockFindFirst.mockResolvedValue({
        id: "org-123",
        slug: "acme-corp",
        ssoConfig: null,
      });

      const result = await checkEmailDomainForSSO("user@acme.com");

      expect(result.shouldRedirect).toBe(false);
    });

    it("returns shouldRedirect=true for verified domain with SSO config", async () => {
      mockFindFirst.mockResolvedValue({
        id: "org-123",
        slug: "acme-corp",
        ssoConfig: {
          type: "OIDC",
          issuer: "https://acme.okta.com",
          clientId: "client-123",
        },
      });

      const result = await checkEmailDomainForSSO("user@acme.com");

      expect(result.shouldRedirect).toBe(true);
      expect(result.orgId).toBe("org-123");
      expect(result.ssoConfig?.type).toBe("OIDC");
    });

    it("normalizes email domain to lowercase", async () => {
      mockFindFirst.mockResolvedValue(null);

      await checkEmailDomainForSSO("user@ACME.COM");

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domain: "acme.com",
          }),
        }),
      );
    });
  });

  describe("buildSAMLAuthUrl", () => {
    it("throws error for missing entryPoint", async () => {
      await expect(
        buildSAMLAuthUrl("org-123", { type: "SAML" }),
      ).rejects.toThrow("SAML config missing entryPoint");
    });

    it("builds SAML auth URL with request ID", async () => {
      const url = await buildSAMLAuthUrl("org-123", {
        type: "SAML",
        entryPoint: "https://idp.example.com/sso",
        issuerName: "expert-ai",
      });

      expect(url).toContain("https://idp.example.com/sso");
      expect(url).toContain("SAMLRequest=");
    });

    it("uses default issuer name when not provided", async () => {
      const url = await buildSAMLAuthUrl("org-123", {
        type: "SAML",
        entryPoint: "https://idp.example.com/sso",
      });

      expect(url).toContain("SAMLRequest=");
    });
  });

  describe("buildOIDCAuthUrl", () => {
    it("throws error for missing issuer", async () => {
      await expect(
        buildOIDCAuthUrl("org-123", { type: "OIDC", clientId: "client-123" }),
      ).rejects.toThrow("OIDC config missing issuer or clientId");
    });

    it("throws error for missing clientId", async () => {
      await expect(
        buildOIDCAuthUrl("org-123", {
          type: "OIDC",
          issuer: "https://issuer.com",
        }),
      ).rejects.toThrow("OIDC config missing issuer or clientId");
    });

    it("builds OIDC authorization URL", async () => {
      const url = await buildOIDCAuthUrl("org-123", {
        type: "OIDC",
        issuer: "https://issuer.example.com",
        clientId: "client-123",
        clientSecret: "secret-123",
      });

      expect(url).toContain("https://idp.example.com/authorize");
    });
  });

  describe("handleSAMLCallback", () => {
    it("throws error when org not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        handleSAMLCallback("invalid-org", "base64response"),
      ).rejects.toThrow("SSO config not found");
    });

    it("throws error when ssoConfig is null", async () => {
      mockFindUnique.mockResolvedValue({ id: "org-123", ssoConfig: null });

      await expect(
        handleSAMLCallback("org-123", "base64response"),
      ).rejects.toThrow("SSO config not found");
    });

    it("extracts email from SAML NameID", async () => {
      const samlXml = `<?xml version="1.0"?>
        <saml:Assertion>
          <saml:NameID>user@example.com</saml:NameID>
        </saml:Assertion>`;

      mockFindUnique.mockResolvedValue({
        id: "org-123",
        ssoConfig: { type: "SAML", cert: "dummy-cert" },
      });

      const result = await handleSAMLCallback(
        "org-123",
        Buffer.from(samlXml).toString("base64"),
      );

      expect(result.email).toBe("user@example.com");
      expect(result.nameId).toBe("user@example.com");
    });
  });
});
