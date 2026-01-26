/**
 * Share API Unit Tests
 *
 * Tests for share link creation, access, and revocation.
 *
 * @see docs/IMPEMENTATION.md - Phase 4.7 Export Share Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET, DELETE } from "../route";

// Mock dependencies
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    shareLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz/cedar", () => ({
  getCedarEngine: vi.fn(() => ({
    isAuthorized: vi.fn(() => ({ isAuthorized: true })),
  })),
  CedarActions: {
    CreateShareLink: "CreateShareLink",
    GetShareLink: "GetShareLink",
    RevokeShareLink: "RevokeShareLink",
    AccessSharedContent: "AccessSharedContent",
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

describe("Share API", () => {
  const mockAuth = auth as ReturnType<typeof vi.fn>;
  const mockSession = prisma.session as {
    findUnique: ReturnType<typeof vi.fn>;
  };
  const mockShareLink = prisma.shareLink as {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  const mockMembership = prisma.membership as {
    findFirst: ReturnType<typeof vi.fn>;
  };
  const mockUser = prisma.user as { findUnique: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/share - Create Share Link", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "11111111-1111-1111-1111-111111111111",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 for invalid request body", async () => {
      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({ visibility: "INVALID" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation Error");
    });

    it("returns 404 if session not found", async () => {
      mockSession.findUnique.mockResolvedValueOnce(null);

      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not Found");
    });

    it("creates share link for owned session", async () => {
      mockSession.findUnique.mockResolvedValueOnce({
        userId: "user-1",
        orgId: "org-1",
      });

      mockShareLink.create.mockResolvedValueOnce({
        id: "share-1",
        token: "abc123def456",
        visibility: "PRIVATE",
        expiresAt: null,
        createdAt: new Date(),
      });

      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "11111111-1111-1111-1111-111111111111",
          visibility: "PRIVATE",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("share-1");
      expect(data.url).toContain("/share/");
      expect(data.visibility).toBe("PRIVATE");
    });

    it("creates share link with expiration", async () => {
      mockSession.findUnique.mockResolvedValueOnce({
        userId: "user-1",
        orgId: null,
      });

      mockShareLink.create.mockResolvedValueOnce({
        id: "share-2",
        token: "xyz789",
        visibility: "PRIVATE",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });

      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "22222222-2222-2222-2222-222222222222",
          expiresInDays: 7,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expiresAt).toBeDefined();
    });
  });

  describe("GET /api/share - Access Share Link", () => {
    it("returns 400 if token missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/share");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Bad Request");
    });

    it("returns 404 if share link not found", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=invalid",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe("Share link not found");
    });

    it("returns 410 if share link is revoked", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        isRevoked: true,
        visibility: "PRIVATE",
        session: { messages: [] },
      });

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=revoked-token",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.message).toBe("Share link has been revoked");
    });

    it("returns 410 if share link expired", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
        visibility: "PRIVATE",
        session: { messages: [] },
      });

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=expired-token",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.message).toBe("Share link has expired");
    });

    it("returns shared content for valid PRIVATE link", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        id: "share-1",
        isRevoked: false,
        expiresAt: null,
        visibility: "PRIVATE",
        allowedEmails: [],
        allowedOrgId: null,
        session: {
          id: "session-1",
          agentId: "ux-analyst",
          createdAt: new Date(),
          messages: [{ content: "Analysis result", jsonData: {} }],
        },
      });

      mockShareLink.update.mockResolvedValueOnce({});

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=valid-token",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe("session-1");
      expect(data.content).toBe("Analysis result");
      expect(mockShareLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessCount: { increment: 1 },
          }),
        }),
      );
    });

    it("returns 401 for TEAM link without auth", async () => {
      mockAuth.mockResolvedValueOnce(null);

      mockShareLink.findUnique.mockResolvedValueOnce({
        isRevoked: false,
        expiresAt: null,
        visibility: "TEAM",
        allowedOrgId: "org-1",
        session: { messages: [] },
      });

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=team-token",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toContain("Authentication required");
    });

    it("returns 403 for TEAM link if not member", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        isRevoked: false,
        expiresAt: null,
        visibility: "TEAM",
        allowedOrgId: "org-1",
        session: { messages: [] },
      });

      mockMembership.findFirst.mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/share?token=team-token",
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.message).toContain("not a member");
    });
  });

  describe("DELETE /api/share - Revoke Share Link", () => {
    it("returns 401 if unauthenticated", async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/share?id=share-1",
        { method: "DELETE" },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 if id missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe("Share link ID is required");
    });

    it("returns 404 if share link not found", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/share?id=non-existent",
        { method: "DELETE" },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Not Found");
    });

    it("returns 409 if already revoked", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        createdBy: "user-1",
        isRevoked: true,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/share?id=share-1",
        { method: "DELETE" },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.message).toBe("Share link already revoked");
    });

    it("revokes share link successfully", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        createdBy: "user-1",
        isRevoked: false,
      });

      mockShareLink.update.mockResolvedValueOnce({});

      const request = new NextRequest(
        "http://localhost:3000/api/share?id=share-1",
        { method: "DELETE" },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockShareLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isRevoked: true,
          }),
        }),
      );
    });
  });

  describe("Security", () => {
    it("cannot share another user's session", async () => {
      mockSession.findUnique.mockResolvedValueOnce({
        userId: "other-user",
        orgId: null,
      });

      const request = new NextRequest("http://localhost:3000/api/share", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "33333333-3333-3333-3333-333333333333",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });

    it("cannot revoke another user's share link", async () => {
      mockShareLink.findUnique.mockResolvedValueOnce({
        createdBy: "other-user",
        isRevoked: false,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/share?id=share-1",
        { method: "DELETE" },
      );

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });
});
