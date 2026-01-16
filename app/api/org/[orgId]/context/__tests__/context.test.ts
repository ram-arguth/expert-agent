/**
 * Organization Context Files API Tests
 *
 * Tests for POST and GET /api/org/:orgId/context
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.2 Org Context Files
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoist mocks to ensure they're available before module imports
const mockGetSignedUrl = vi
  .fn()
  .mockResolvedValue(["https://storage.googleapis.com/signed-url"]);

// Mock modules before imports
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
    },
    contextFile: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authz/cedar", () => ({
  getCedarEngine: vi.fn(() => ({
    isAuthorized: vi.fn(() => ({ isAuthorized: false })),
  })),
  CedarActions: {
    ManageContextFiles: "ManageContextFiles",
  },
}));

vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockReturnValue({
      file: vi.fn().mockReturnValue({
        getSignedUrl: mockGetSignedUrl,
      }),
    }),
  })),
}));

import { GET, POST } from "../route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

describe("Org Context Files API", () => {
  const mockOrgId = "org-123";
  const mockUserId = "user-456";

  function createRequest(method: string, body?: object): NextRequest {
    const url = `http://localhost:3000/api/org/${mockOrgId}/context`;
    return new NextRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: { "Content-Type": "application/json" },
    });
  }

  function createContext() {
    return { params: Promise.resolve({ orgId: mockOrgId }) };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/org/:orgId/context", () => {
    describe("Authentication", () => {
      it("returns 401 when not authenticated", async () => {
        vi.mocked(auth).mockResolvedValue(null);

        const request = createRequest("POST", {
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
      });
    });

    describe("Authorization", () => {
      it("returns 403 when user is not a member of the org", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

        const request = createRequest("POST", {
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.message).toBe("Not a member of this organization");
      });

      it("returns 403 when user is a regular member (not admin)", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "MEMBER",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createRequest("POST", {
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.message).toBe(
          "Only owners and admins can upload context files",
        );
      });
    });

    describe("Validation", () => {
      beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "ADMIN",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      it("returns 400 for invalid MIME type", async () => {
        const request = createRequest("POST", {
          filename: "malware.exe",
          mimeType: "application/x-msdownload",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation Error");
      });

      it("returns 400 for file too large", async () => {
        const request = createRequest("POST", {
          filename: "huge.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100 * 1024 * 1024, // 100MB
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation Error");
      });

      it("returns 400 for missing filename", async () => {
        const request = createRequest("POST", {
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Validation Error");
      });
    });

    describe("Limits", () => {
      beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "OWNER",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      it("returns 400 when context file limit exceeded", async () => {
        vi.mocked(prisma.contextFile.count).mockResolvedValue(20);

        const request = createRequest("POST", {
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Limit Exceeded");
      });
    });

    describe("Successful Upload", () => {
      beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "ADMIN",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(prisma.contextFile.count).mockResolvedValue(5);
      });

      // TODO: Fix GCS mock - requires ESM module interception
      it.skip("creates context file and returns signed URL", async () => {
        const mockContextFile = {
          id: "context-file-1",
          orgId: mockOrgId,
          name: "test.pdf",
          gcsPath: "orgs/org-123/context/123_test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          agentIds: [],
          createdAt: new Date(),
          uploadedById: mockUserId,
        };

        vi.mocked(prisma.contextFile.create).mockResolvedValue(mockContextFile);

        const request = createRequest("POST", {
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.uploadUrl).toBeDefined();
        expect(data.fileId).toBe("context-file-1");
        expect(data.gcsPath).toContain("orgs/org-123/context/");
      });

      // TODO: Fix GCS mock - requires ESM module interception
      it.skip("accepts optional agentIds filter", async () => {
        const mockContextFile = {
          id: "context-file-1",
          orgId: mockOrgId,
          name: "legal-docs.pdf",
          gcsPath: "orgs/org-123/context/123_legal-docs.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          agentIds: ["legal-advisor", "risk-analyst"],
          createdAt: new Date(),
          uploadedById: mockUserId,
        };

        vi.mocked(prisma.contextFile.create).mockResolvedValue(mockContextFile);

        const request = createRequest("POST", {
          filename: "legal-docs.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          agentIds: ["legal-advisor", "risk-analyst"],
        });

        const response = await POST(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.file.agentIds).toEqual(["legal-advisor", "risk-analyst"]);
      });
    });
  });

  describe("GET /api/org/:orgId/context", () => {
    describe("Authentication", () => {
      it("returns 401 when not authenticated", async () => {
        vi.mocked(auth).mockResolvedValue(null);

        const request = createRequest("GET");
        const response = await GET(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
      });
    });

    describe("Authorization", () => {
      it("returns 403 when user is not a member of the org", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);

        const request = createRequest("GET");
        const response = await GET(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.message).toBe("Not a member of this organization");
      });

      it("allows regular members to view context files", async () => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "MEMBER",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        vi.mocked(prisma.contextFile.findMany).mockResolvedValue([]);

        const request = createRequest("GET");
        const response = await GET(request, createContext());

        expect(response.status).toBe(200);
      });
    });

    describe("Successful List", () => {
      beforeEach(() => {
        vi.mocked(auth).mockResolvedValue({
          user: { id: mockUserId, email: "test@example.com" },
          expires: new Date().toISOString(),
        });

        vi.mocked(prisma.membership.findUnique).mockResolvedValue({
          role: "MEMBER",
          id: "membership-1",
          userId: mockUserId,
          orgId: mockOrgId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      it("returns empty list when no context files", async () => {
        vi.mocked(prisma.contextFile.findMany).mockResolvedValue([]);

        const request = createRequest("GET");
        const response = await GET(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.files).toEqual([]);
        expect(data.count).toBe(0);
        expect(data.limit).toBe(20);
        expect(data.remaining).toBe(20);
      });

      it("returns context files with metadata", async () => {
        const mockFiles = [
          {
            id: "file-1",
            orgId: mockOrgId,
            name: "policies.pdf",
            gcsPath: "orgs/org-123/context/policies.pdf",
            mimeType: "application/pdf",
            sizeBytes: 10240,
            agentIds: [],
            createdAt: new Date("2024-01-01"),
            uploadedById: "user-1",
          },
          {
            id: "file-2",
            orgId: mockOrgId,
            name: "guidelines.docx",
            gcsPath: "orgs/org-123/context/guidelines.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeBytes: 20480,
            agentIds: ["legal-advisor"],
            createdAt: new Date("2024-01-02"),
            uploadedById: "user-2",
          },
        ];

        vi.mocked(prisma.contextFile.findMany).mockResolvedValue(mockFiles);

        const request = createRequest("GET");
        const response = await GET(request, createContext());
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.files).toHaveLength(2);
        expect(data.count).toBe(2);
        expect(data.remaining).toBe(18);
      });
    });
  });

  describe("Security", () => {
    // TODO: Fix GCS mock - requires ESM module interception
    it.skip("sanitizes filename to prevent path traversal", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        role: "OWNER",
        id: "membership-1",
        userId: mockUserId,
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.contextFile.count).mockResolvedValue(0);

      const mockContextFile = {
        id: "context-file-1",
        orgId: mockOrgId,
        name: "___test.pdf",
        gcsPath: "orgs/org-123/context/123___test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        agentIds: [],
        createdAt: new Date(),
        uploadedById: mockUserId,
      };

      vi.mocked(prisma.contextFile.create).mockResolvedValue(mockContextFile);

      const request = createRequest("POST", {
        filename: "../../../etc/passwd",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      });

      const response = await POST(request, createContext());
      const data = await response.json();

      // Should sanitize the filename
      expect(response.status).toBe(200);
      expect(data.gcsPath).not.toContain("..");
      expect(prisma.contextFile.create).toHaveBeenCalled();
    });

    it("rejects executable file types", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: mockUserId, email: "test@example.com" },
        expires: new Date().toISOString(),
      });

      vi.mocked(prisma.membership.findUnique).mockResolvedValue({
        role: "ADMIN",
        id: "membership-1",
        userId: mockUserId,
        orgId: mockOrgId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const maliciousTypes = [
        "application/x-executable",
        "application/x-sh",
        "text/html",
        "application/javascript",
      ];

      for (const mimeType of maliciousTypes) {
        const request = createRequest("POST", {
          filename: "malicious.bin",
          mimeType,
          sizeBytes: 1024,
        });

        const response = await POST(request, createContext());
        expect(response.status).toBe(400);
      }
    });
  });
});
