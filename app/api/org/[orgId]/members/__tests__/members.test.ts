/**
 * Members API Tests
 *
 * Tests for GET /api/org/:orgId/members
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Team Org Creation & Invites
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock dependencies
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz/cedar", () => ({
  getCedarEngine: vi.fn(() => ({
    isAuthorized: vi.fn(() => ({ isAuthorized: false, reason: "Test deny" })),
  })),
  CedarActions: {
    GetOrg: "GetOrg",
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

describe("Members API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = () => {
    return new NextRequest("http://localhost:3000/api/org/org-123/members", {
      method: "GET",
    });
  };

  const createContext = (orgId: string) => ({
    params: Promise.resolve({ orgId }),
  });

  describe("GET /api/org/:orgId/members", () => {
    it("returns 401 for unauthenticated requests", async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = createRequest();
      const response = await GET(request, createContext("org-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 for non-members", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: "2030-01-01",
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

      const request = createRequest();
      const response = await GET(request, createContext("org-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
      expect(data.message).toContain("Not a member");
    });

    it("returns members list for org member", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: "2030-01-01",
      });

      // User is a member
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: "membership-1",
        userId: "user-123",
        orgId: "org-123",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Return member list
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        {
          id: "membership-1",
          userId: "owner-1",
          orgId: "org-123",
          role: "OWNER",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "owner-1",
            name: "John Owner",
            email: "john@example.com",
            image: null,
          },
        },
        {
          id: "membership-2",
          userId: "member-1",
          orgId: "org-123",
          role: "MEMBER",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "member-1",
            name: "Jane Member",
            email: "jane@example.com",
            image: null,
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.membership.findMany>>);

      const request = createRequest();
      const response = await GET(request, createContext("org-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(2);
      expect(data.members[0].role).toBe("OWNER");
      expect(data.members[0].user.name).toBe("John Owner");
      expect(data.members[1].role).toBe("MEMBER");
      expect(data.members[1].user.email).toBe("jane@example.com");
    });

    it("includes all required member fields", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: "2030-01-01",
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: "membership-1",
        userId: "user-123",
        orgId: "org-123",
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        {
          id: "membership-1",
          userId: "user-123",
          orgId: "org-123",
          role: "OWNER",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: "user-123",
            name: "Test User",
            email: "test@example.com",
            image: "https://example.com/avatar.png",
          },
        },
      ] as unknown as Awaited<ReturnType<typeof prisma.membership.findMany>>);

      const request = createRequest();
      const response = await GET(request, createContext("org-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(1);

      const member = data.members[0];
      expect(member).toHaveProperty("id");
      expect(member).toHaveProperty("userId");
      expect(member).toHaveProperty("role");
      expect(member.user).toHaveProperty("id");
      expect(member.user).toHaveProperty("name");
      expect(member.user).toHaveProperty("email");
      expect(member.user).toHaveProperty("image");
    });

    it("returns empty array when org has no members (edge case)", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: "2030-01-01",
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: "membership-1",
        userId: "user-123",
        orgId: "org-123",
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      const request = createRequest();
      const response = await GET(request, createContext("org-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toEqual([]);
    });

    it("uses correct orgId from route params", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-123", email: "test@example.com" },
        expires: "2030-01-01",
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        id: "membership-1",
        userId: "user-123",
        orgId: "specific-org-id",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      const request = createRequest();
      await GET(request, createContext("specific-org-id"));

      // Verify findMany was called with the correct orgId
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: "specific-org-id" },
        }),
      );
    });
  });
});
