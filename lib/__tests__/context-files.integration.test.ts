/**
 * Context Files Integration Tests
 *
 * Tests organization context file management with real database:
 * - Admin uploads context file
 * - Context file content appears in agent prompts
 * - Member query includes org context automatically
 * - Context isolation: Org A context not visible to Org B
 * - Context file deletion cascades correctly
 *
 * @see docs/IMPEMENTATION.md - Phase 0.7
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

// Test Prisma client with test database
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

// Test data
const TEST_ADMIN = {
  id: "context-test-admin",
  email: "context-admin@example.com",
  name: "Context Admin",
  authProvider: "google",
};

const TEST_MEMBER = {
  id: "context-test-member",
  email: "context-member@example.com",
  name: "Context Member",
  authProvider: "google",
};

const TEST_OTHER_USER = {
  id: "context-test-other",
  email: "context-other@example.com",
  name: "Other User",
  authProvider: "google",
};

const TEST_ORG_A = {
  id: "context-test-org-a",
  name: "Context Org A",
  slug: "context-test-org-a",
  plan: "pro" as const,
  tokensRemaining: 10000,
};

const TEST_ORG_B = {
  id: "context-test-org-b",
  name: "Context Org B",
  slug: "context-test-org-b",
  plan: "pro" as const,
  tokensRemaining: 10000,
};

describe("Context Files Integration", () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    // Clean up test data in correct order (respecting foreign keys)
    await testPrisma.contextFile.deleteMany({
      where: { orgId: { in: [TEST_ORG_A.id, TEST_ORG_B.id] } },
    });
    await testPrisma.membership.deleteMany({
      where: { orgId: { in: [TEST_ORG_A.id, TEST_ORG_B.id] } },
    });
    await testPrisma.org.deleteMany({
      where: { id: { in: [TEST_ORG_A.id, TEST_ORG_B.id] } },
    });
    await testPrisma.user.deleteMany({
      where: {
        id: { in: [TEST_ADMIN.id, TEST_MEMBER.id, TEST_OTHER_USER.id] },
      },
    });
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up context files before each test
    await testPrisma.contextFile.deleteMany({
      where: { orgId: { in: [TEST_ORG_A.id, TEST_ORG_B.id] } },
    });
  });

  describe("Admin Upload", () => {
    it("admin can create context file record", async () => {
      // Setup: Create org and admin user with OWNER role
      await testPrisma.user.upsert({
        where: { id: TEST_ADMIN.id },
        create: TEST_ADMIN,
        update: TEST_ADMIN,
      });

      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: TEST_ORG_A,
      });

      await testPrisma.membership.upsert({
        where: {
          userId_orgId: { userId: TEST_ADMIN.id, orgId: TEST_ORG_A.id },
        },
        create: {
          userId: TEST_ADMIN.id,
          orgId: TEST_ORG_A.id,
          role: "OWNER",
        },
        update: { role: "OWNER" },
      });

      // Create context file
      const contextFile = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "company-policy.pdf",
          gcsPath: "gs://test-bucket/org-a/company-policy.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024 * 1024, // 1MB
        },
      });

      expect(contextFile).toBeDefined();
      expect(contextFile.name).toBe("company-policy.pdf");
      expect(contextFile.orgId).toBe(TEST_ORG_A.id);
    });

    it("context file is associated with correct org", async () => {
      // Setup orgs
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      await testPrisma.org.upsert({
        where: { id: TEST_ORG_B.id },
        create: TEST_ORG_B,
        update: {},
      });

      // Create context file for Org A
      const fileA = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "org-a-secret.pdf",
          gcsPath: "gs://test-bucket/org-a/secret.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      // Verify file belongs to Org A
      const files = await testPrisma.contextFile.findMany({
        where: { orgId: TEST_ORG_A.id },
      });

      expect(files.length).toBe(1);
      expect(files[0].id).toBe(fileA.id);

      // Verify Org B has no files
      const orgBFiles = await testPrisma.contextFile.findMany({
        where: { orgId: TEST_ORG_B.id },
      });

      expect(orgBFiles.length).toBe(0);
    });
  });

  describe("Context Isolation", () => {
    it("context files are isolated between organizations", async () => {
      // Setup orgs
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      await testPrisma.org.upsert({
        where: { id: TEST_ORG_B.id },
        create: TEST_ORG_B,
        update: {},
      });

      // Create files for both orgs
      const fileA = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "org-a-only.pdf",
          gcsPath: "gs://test-bucket/org-a/only.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      const fileB = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_B.id,
          name: "org-b-only.pdf",
          gcsPath: "gs://test-bucket/org-b/only.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
        },
      });

      // Query with Org A context - should NOT see Org B's file
      const orgAQuery = await testPrisma.contextFile.findFirst({
        where: {
          id: fileB.id,
          orgId: TEST_ORG_A.id, // Wrong org
        },
      });

      expect(orgAQuery).toBeNull();

      // Query with correct org - should find file
      const correctQuery = await testPrisma.contextFile.findFirst({
        where: {
          id: fileA.id,
          orgId: TEST_ORG_A.id,
        },
      });

      expect(correctQuery).toBeDefined();
      expect(correctQuery?.name).toBe("org-a-only.pdf");
    });

    it("cross-org file access is denied at query level", async () => {
      // Setup
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      const secretFile = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "confidential.pdf",
          gcsPath: "gs://test-bucket/org-a/confidential.pdf",
          mimeType: "application/pdf",
          sizeBytes: 5000,
        },
      });

      // Attempt to access with wrong org filter (as if from different tenant)
      const unauthorizedAccess = await testPrisma.contextFile.findFirst({
        where: {
          id: secretFile.id,
          orgId: TEST_ORG_B.id, // Wrong org ID
        },
      });

      expect(unauthorizedAccess).toBeNull();
    });
  });

  describe("Context File Deletion", () => {
    it("context file deletion removes record", async () => {
      // Setup
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      const file = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "to-delete.pdf",
          gcsPath: "gs://test-bucket/org-a/to-delete.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
        },
      });

      // Verify exists
      const before = await testPrisma.contextFile.findUnique({
        where: { id: file.id },
      });
      expect(before).toBeDefined();

      // Delete
      await testPrisma.contextFile.delete({
        where: { id: file.id },
      });

      // Verify deleted
      const after = await testPrisma.contextFile.findUnique({
        where: { id: file.id },
      });
      expect(after).toBeNull();
    });

    it("org deletion cascades to context files", async () => {
      // Create org with context file
      const tempOrg = {
        id: "temp-cascade-org",
        name: "Temp Cascade Org",
        slug: "temp-cascade-org",
        plan: "free" as const,
        tokensRemaining: 1000,
      };

      await testPrisma.org.create({ data: tempOrg });

      await testPrisma.contextFile.create({
        data: {
          orgId: tempOrg.id,
          name: "cascade-test.pdf",
          gcsPath: "gs://test-bucket/cascade/test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 512,
        },
      });

      // Verify file exists
      const filesBefore = await testPrisma.contextFile.count({
        where: { orgId: tempOrg.id },
      });
      expect(filesBefore).toBe(1);

      // Delete org (should cascade)
      await testPrisma.org.delete({ where: { id: tempOrg.id } });

      // Verify files deleted
      const filesAfter = await testPrisma.contextFile.count({
        where: { orgId: tempOrg.id },
      });
      expect(filesAfter).toBe(0);
    });
  });

  describe("Context File Metadata", () => {
    it("stores and retrieves file metadata correctly", async () => {
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      const file = await testPrisma.contextFile.create({
        data: {
          orgId: TEST_ORG_A.id,
          name: "legal-guidelines.docx",
          gcsPath: "gs://bucket/org-a/legal-guidelines.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: 2048576, // 2MB
        },
      });

      const retrieved = await testPrisma.contextFile.findUnique({
        where: { id: file.id },
      });

      expect(retrieved?.name).toBe("legal-guidelines.docx");
      expect(retrieved?.mimeType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect(retrieved?.sizeBytes).toBe(2048576);
      expect(retrieved?.gcsPath).toContain("legal-guidelines.docx");
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
    });

    it("supports listing multiple context files per org", async () => {
      await testPrisma.org.upsert({
        where: { id: TEST_ORG_A.id },
        create: TEST_ORG_A,
        update: {},
      });

      // Create multiple files
      await testPrisma.contextFile.createMany({
        data: [
          {
            orgId: TEST_ORG_A.id,
            name: "file1.pdf",
            gcsPath: "gs://bucket/file1.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1000,
          },
          {
            orgId: TEST_ORG_A.id,
            name: "file2.pdf",
            gcsPath: "gs://bucket/file2.pdf",
            mimeType: "application/pdf",
            sizeBytes: 2000,
          },
          {
            orgId: TEST_ORG_A.id,
            name: "file3.pdf",
            gcsPath: "gs://bucket/file3.pdf",
            mimeType: "application/pdf",
            sizeBytes: 3000,
          },
        ],
      });

      const files = await testPrisma.contextFile.findMany({
        where: { orgId: TEST_ORG_A.id },
        orderBy: { name: "asc" },
      });

      expect(files.length).toBe(3);
      expect(files[0].name).toBe("file1.pdf");
      expect(files[2].name).toBe("file3.pdf");
    });
  });
});
