/**
 * SSO Service Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 1.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkEmailDomainForSSO, buildSAMLAuthUrl } from "../sso-service";

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
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
}));

import { prisma } from "@/lib/db";
import type { Mock } from "vitest";

const mockFindFirst = prisma.org.findFirst as Mock;

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
  });
});
