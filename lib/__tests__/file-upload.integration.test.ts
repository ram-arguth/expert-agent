/**
 * Integration Tests: File Upload & Storage
 *
 * Tests file metadata persistence:
 * - User file uploads
 * - Organization context files
 * - MIME type validation
 * - File size tracking
 * - Agent scope filtering
 *
 * Note: These tests verify database persistence.
 * GCS operations are mocked at the API layer.
 *
 * Run with: pnpm test:integration file-upload
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from "@/lib/test-utils/integration";

describe("File Upload Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe("User File Uploads", () => {
    it("stores file metadata after upload", async () => {
      const user = await testPrisma.user.create({
        data: {
          email: "uploader@example.com",
          name: "File Uploader",
          authProvider: "google",
        },
      });

      const file = await testPrisma.file.create({
        data: {
          userId: user.id,
          name: "screenshot.png",
          gcsPath: "gs://expert-ai-dev/uploads/user-123/screenshot-abc.png",
          mimeType: "image/png",
          sizeBytes: 245678,
        },
      });

      expect(file.id).toBeDefined();
      expect(file.name).toBe("screenshot.png");
      expect(file.mimeType).toBe("image/png");
      expect(file.sizeBytes).toBe(245678);
    });

    it("supports PDF file uploads", async () => {
      const user = await testPrisma.user.create({
        data: { email: "pdf-user@test.com", authProvider: "google" },
      });

      const file = await testPrisma.file.create({
        data: {
          userId: user.id,
          name: "contract.pdf",
          gcsPath: "gs://expert-ai-dev/uploads/user-456/contract-def.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024 * 1024 * 5, // 5MB
        },
      });

      expect(file.mimeType).toBe("application/pdf");
      expect(file.sizeBytes).toBe(5242880);
    });

    it("retrieves user files by userId", async () => {
      const user = await testPrisma.user.create({
        data: { email: "multi-file@test.com", authProvider: "google" },
      });

      await testPrisma.file.createMany({
        data: [
          {
            userId: user.id,
            name: "file1.png",
            gcsPath: "gs://bucket/f1",
            mimeType: "image/png",
            sizeBytes: 100,
          },
          {
            userId: user.id,
            name: "file2.jpg",
            gcsPath: "gs://bucket/f2",
            mimeType: "image/jpeg",
            sizeBytes: 200,
          },
          {
            userId: user.id,
            name: "file3.pdf",
            gcsPath: "gs://bucket/f3",
            mimeType: "application/pdf",
            sizeBytes: 300,
          },
        ],
      });

      const files = await testPrisma.file.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
      });

      expect(files.length).toBe(3);
      expect(files[0].name).toBe("file1.png");
    });

    it("deletes files when user is deleted (cascade)", async () => {
      const user = await testPrisma.user.create({
        data: { email: "delete-test@test.com", authProvider: "google" },
      });

      await testPrisma.file.create({
        data: {
          userId: user.id,
          name: "cascade.png",
          gcsPath: "gs://bucket/cascade",
          mimeType: "image/png",
          sizeBytes: 100,
        },
      });

      await testPrisma.user.delete({ where: { id: user.id } });

      const orphanFiles = await testPrisma.file.findMany({
        where: { userId: user.id },
      });

      expect(orphanFiles.length).toBe(0);
    });
  });

  describe("Organization Context Files", () => {
    it("creates context file for org", async () => {
      const user = await testPrisma.user.create({
        data: { email: "context-uploader@test.com", authProvider: "google" },
      });

      const org = await testPrisma.org.create({
        data: { name: "Context Org", slug: "context-org", type: "TEAM" },
      });

      const contextFile = await testPrisma.contextFile.create({
        data: {
          orgId: org.id,
          name: "brand-guidelines.pdf",
          gcsPath: "gs://expert-ai-dev/context/org-123/brand-guidelines.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2500000,
          uploadedById: user.id,
          agentIds: [], // All agents
        },
      });

      expect(contextFile.orgId).toBe(org.id);
      expect(contextFile.uploadedById).toBe(user.id);
      expect(contextFile.agentIds).toEqual([]);
    });

    it("scopes context file to specific agents", async () => {
      const org = await testPrisma.org.create({
        data: { name: "Scoped Org", slug: "scoped-org", type: "TEAM" },
      });

      const contextFile = await testPrisma.contextFile.create({
        data: {
          orgId: org.id,
          name: "legal-templates.docx",
          gcsPath: "gs://bucket/legal-templates.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: 500000,
          agentIds: ["legal-advisor"], // Only legal agent
        },
      });

      expect(contextFile.agentIds).toContain("legal-advisor");
      expect(contextFile.agentIds.length).toBe(1);
    });

    it("retrieves context files for specific agent", async () => {
      const org = await testPrisma.org.create({
        data: { name: "Filter Org", slug: "filter-org", type: "TEAM" },
      });

      await testPrisma.contextFile.createMany({
        data: [
          {
            orgId: org.id,
            name: "all-agents.pdf",
            gcsPath: "gs://b/all",
            mimeType: "application/pdf",
            sizeBytes: 100,
            agentIds: [],
          },
          {
            orgId: org.id,
            name: "ux-only.pdf",
            gcsPath: "gs://b/ux",
            mimeType: "application/pdf",
            sizeBytes: 100,
            agentIds: ["ux-analyst"],
          },
          {
            orgId: org.id,
            name: "legal-only.pdf",
            gcsPath: "gs://b/legal",
            mimeType: "application/pdf",
            sizeBytes: 100,
            agentIds: ["legal-advisor"],
          },
          {
            orgId: org.id,
            name: "multi.pdf",
            gcsPath: "gs://b/multi",
            mimeType: "application/pdf",
            sizeBytes: 100,
            agentIds: ["ux-analyst", "legal-advisor"],
          },
        ],
      });

      // Find files available to ux-analyst
      const uxFiles = await testPrisma.contextFile.findMany({
        where: {
          orgId: org.id,
          OR: [
            { agentIds: { isEmpty: true } }, // All agents
            { agentIds: { has: "ux-analyst" } }, // Includes UX
          ],
        },
      });

      expect(uxFiles.length).toBe(3); // all-agents, ux-only, multi
      expect(uxFiles.map((f) => f.name).sort()).toEqual([
        "all-agents.pdf",
        "multi.pdf",
        "ux-only.pdf",
      ]);
    });

    it("deletes context files when org is deleted (cascade)", async () => {
      const org = await testPrisma.org.create({
        data: { name: "Delete Org", slug: "delete-org", type: "TEAM" },
      });

      await testPrisma.contextFile.create({
        data: {
          orgId: org.id,
          name: "orphan.pdf",
          gcsPath: "gs://bucket/orphan",
          mimeType: "application/pdf",
          sizeBytes: 100,
        },
      });

      await testPrisma.org.delete({ where: { id: org.id } });

      const orphanFiles = await testPrisma.contextFile.findMany({
        where: { orgId: org.id },
      });

      expect(orphanFiles.length).toBe(0);
    });
  });

  describe("MIME Type Validation", () => {
    it("stores various supported MIME types", async () => {
      const user = await testPrisma.user.create({
        data: { email: "mime-test@test.com", authProvider: "google" },
      });

      const supportedTypes = [
        { name: "image.png", mimeType: "image/png" },
        { name: "image.jpg", mimeType: "image/jpeg" },
        { name: "image.gif", mimeType: "image/gif" },
        { name: "image.webp", mimeType: "image/webp" },
        { name: "doc.pdf", mimeType: "application/pdf" },
        { name: "text.txt", mimeType: "text/plain" },
        { name: "data.json", mimeType: "application/json" },
      ];

      for (const { name, mimeType } of supportedTypes) {
        const file = await testPrisma.file.create({
          data: {
            userId: user.id,
            name,
            gcsPath: `gs://bucket/${name}`,
            mimeType,
            sizeBytes: 100,
          },
        });
        expect(file.mimeType).toBe(mimeType);
      }
    });
  });

  describe("File Size Limits", () => {
    it("stores large file metadata (50MB)", async () => {
      const user = await testPrisma.user.create({
        data: { email: "large-file@test.com", authProvider: "google" },
      });

      const largeFileSize = 50 * 1024 * 1024; // 50MB

      const file = await testPrisma.file.create({
        data: {
          userId: user.id,
          name: "large-video.mp4",
          gcsPath: "gs://bucket/large-video.mp4",
          mimeType: "video/mp4",
          sizeBytes: largeFileSize,
        },
      });

      expect(file.sizeBytes).toBe(largeFileSize);
    });

    it("calculates total storage per user", async () => {
      const user = await testPrisma.user.create({
        data: { email: "storage-calc@test.com", authProvider: "google" },
      });

      await testPrisma.file.createMany({
        data: [
          {
            userId: user.id,
            name: "f1",
            gcsPath: "gs://b/f1",
            mimeType: "image/png",
            sizeBytes: 1000,
          },
          {
            userId: user.id,
            name: "f2",
            gcsPath: "gs://b/f2",
            mimeType: "image/png",
            sizeBytes: 2000,
          },
          {
            userId: user.id,
            name: "f3",
            gcsPath: "gs://b/f3",
            mimeType: "image/png",
            sizeBytes: 3000,
          },
        ],
      });

      const total = await testPrisma.file.aggregate({
        where: { userId: user.id },
        _sum: { sizeBytes: true },
      });

      expect(total._sum.sizeBytes).toBe(6000);
    });
  });
});
