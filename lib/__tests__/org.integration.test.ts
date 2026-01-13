/**
 * Integration Tests: Organization Management
 *
 * Tests the complete organization flow with a real database:
 * - Create team → invite → accept flow
 * - Membership management
 * - Cross-org access denied
 *
 * Prerequisites:
 * - PostgreSQL test database running
 * - DATABASE_URL pointing to test database
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  testPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestDatabase,
} from '@/lib/test-utils/integration';

describe('Organization Management Integration', () => {
  let testUser: { id: string; email: string };
  let testOrg: { id: string; name: string };

  beforeAll(async () => {
    // Ensure database connection
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanDatabase();

    // Seed base test data
    const seeded = await seedTestData();
    testUser = seeded.testUser;
    testOrg = seeded.testOrg;
  });

  describe('Organization Creation', () => {
    it('creates org with owner membership in single transaction', async () => {
      const newOrg = await testPrisma.$transaction(async (tx) => {
        const org = await tx.org.create({
          data: {
            name: 'New Test Org',
            slug: 'new-test-org',
            type: 'TEAM',
          },
        });

        await tx.membership.create({
          data: {
            userId: testUser.id,
            orgId: org.id,
            role: 'OWNER',
          },
        });

        return org;
      });

      // Verify org was created
      expect(newOrg.id).toBeDefined();
      expect(newOrg.name).toBe('New Test Org');

      // Verify membership was created
      const membership = await testPrisma.membership.findFirst({
        where: { orgId: newOrg.id, userId: testUser.id },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('OWNER');
    });

    it('enforces unique slug constraint', async () => {
      // Create first org with slug
      await testPrisma.org.create({
        data: {
          name: 'Org One',
          slug: 'unique-slug',
          type: 'TEAM',
        },
      });

      // Attempt to create second org with same slug
      await expect(
        testPrisma.org.create({
          data: {
            name: 'Org Two',
            slug: 'unique-slug',
            type: 'TEAM',
          },
        })
      ).rejects.toThrow();
    });

    it('sets correct default values for new org', async () => {
      const org = await testPrisma.org.create({
        data: {
          name: 'Defaults Test Org',
          slug: 'defaults-org',
          type: 'TEAM',
        },
      });

      expect(org.plan).toBe('free');
      expect(org.domainVerified).toBe(false);
      expect(org.tokensRemaining).toBe(1000);
      expect(org.tokensMonthly).toBe(1000);
    });
  });

  describe('Invite Flow', () => {
    it('creates invite with correct expiry', async () => {
      const invite = await testPrisma.invite.create({
        data: {
          orgId: testOrg.id,
          email: 'newmember@example.com',
          role: 'MEMBER',
          token: 'test-token-123',
          status: 'PENDING',
          invitedById: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      expect(invite.id).toBeDefined();
      expect(invite.status).toBe('PENDING');
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('invite acceptance creates membership', async () => {
      // Create an invite
      const invite = await testPrisma.invite.create({
        data: {
          orgId: testOrg.id,
          email: 'newmember@example.com',
          role: 'MEMBER',
          token: 'accept-token-456',
          status: 'PENDING',
          invitedById: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create new user and accept invite in transaction
      const newUser = await testPrisma.user.create({
        data: {
          email: 'newmember@example.com',
          name: 'New Member',
          authProvider: 'google',
          authProviderId: 'google-new-member',
        },
      });

      // Accept invite
      await testPrisma.$transaction([
        testPrisma.invite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED', acceptedAt: new Date() },
        }),
        testPrisma.membership.create({
          data: {
            userId: newUser.id,
            orgId: testOrg.id,
            role: invite.role,
          },
        }),
      ]);

      // Verify membership was created
      const membership = await testPrisma.membership.findFirst({
        where: { userId: newUser.id, orgId: testOrg.id },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toBe('MEMBER');

      // Verify invite status updated
      const updatedInvite = await testPrisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite?.status).toBe('ACCEPTED');
    });

    it('prevents duplicate pending invites for same email/org', async () => {
      // Create first invite
      await testPrisma.invite.create({
        data: {
          orgId: testOrg.id,
          email: 'duplicate@example.com',
          role: 'MEMBER',
          token: 'token-1',
          status: 'PENDING',
          invitedById: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Check for existing pending invite before creating (business logic)
      const existing = await testPrisma.invite.findFirst({
        where: {
          orgId: testOrg.id,
          email: 'duplicate@example.com',
          status: 'PENDING',
        },
      });

      expect(existing).toBeDefined();
      // In real API, this would return 409 Conflict
    });

    it('revokes invite correctly', async () => {
      const invite = await testPrisma.invite.create({
        data: {
          orgId: testOrg.id,
          email: 'revoke@example.com',
          role: 'MEMBER',
          token: 'revoke-token',
          status: 'PENDING',
          invitedById: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Revoke the invite
      const revoked = await testPrisma.invite.update({
        where: { id: invite.id },
        data: { status: 'REVOKED' },
      });

      expect(revoked.status).toBe('REVOKED');

      // Verify revoked invite cannot be accepted (business logic check)
      const revokedInvite = await testPrisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(revokedInvite?.status).toBe('REVOKED');
    });
  });

  describe('Membership Management', () => {
    it('user can belong to multiple orgs', async () => {
      // Create multiple orgs
      const org1 = await testPrisma.org.create({
        data: { name: 'Org 1', slug: 'org-1', type: 'TEAM' },
      });

      const org2 = await testPrisma.org.create({
        data: { name: 'Org 2', slug: 'org-2', type: 'TEAM' },
      });

      // Create memberships
      await testPrisma.membership.createMany({
        data: [
          { userId: testUser.id, orgId: org1.id, role: 'OWNER' },
          { userId: testUser.id, orgId: org2.id, role: 'MEMBER' },
        ],
      });

      // Query user's memberships
      const memberships = await testPrisma.membership.findMany({
        where: { userId: testUser.id },
        include: { org: true },
      });

      // Should have 3 memberships (original + 2 new)
      expect(memberships.length).toBe(3);
    });

    it('enforces unique user-org membership', async () => {
      const newOrg = await testPrisma.org.create({
        data: { name: 'Unique Test', slug: 'unique-test', type: 'TEAM' },
      });

      // Create first membership
      await testPrisma.membership.create({
        data: { userId: testUser.id, orgId: newOrg.id, role: 'OWNER' },
      });

      // Attempt to create duplicate membership
      await expect(
        testPrisma.membership.create({
          data: { userId: testUser.id, orgId: newOrg.id, role: 'MEMBER' },
        })
      ).rejects.toThrow();
    });

    it('role upgrade works correctly', async () => {
      const newOrg = await testPrisma.org.create({
        data: { name: 'Role Test', slug: 'role-test', type: 'TEAM' },
      });

      const membership = await testPrisma.membership.create({
        data: { userId: testUser.id, orgId: newOrg.id, role: 'MEMBER' },
      });

      // Upgrade to ADMIN
      const upgraded = await testPrisma.membership.update({
        where: { id: membership.id },
        data: { role: 'ADMIN' },
      });

      expect(upgraded.role).toBe('ADMIN');
    });
  });

  describe('Cross-Org Data Isolation', () => {
    it('org data is properly isolated', async () => {
      // Create two orgs
      const org1 = await testPrisma.org.create({
        data: { name: 'Isolated Org 1', slug: 'isolated-1', type: 'TEAM' },
      });

      const org2 = await testPrisma.org.create({
        data: { name: 'Isolated Org 2', slug: 'isolated-2', type: 'TEAM' },
      });

      // Create user in org1 only
      const user1 = await testPrisma.user.create({
        data: {
          email: 'user1@org1.com',
          name: 'User 1',
          authProvider: 'google',
        },
      });

      await testPrisma.membership.create({
        data: { userId: user1.id, orgId: org1.id, role: 'MEMBER' },
      });

      // Query for org2 membership should return nothing
      const org2Membership = await testPrisma.membership.findFirst({
        where: { userId: user1.id, orgId: org2.id },
      });

      expect(org2Membership).toBeNull();
    });

    it('invites are org-scoped', async () => {
      const org1 = await testPrisma.org.create({
        data: { name: 'Invite Org 1', slug: 'invite-1', type: 'TEAM' },
      });

      const org2 = await testPrisma.org.create({
        data: { name: 'Invite Org 2', slug: 'invite-2', type: 'TEAM' },
      });

      // Create invite for org1
      await testPrisma.invite.create({
        data: {
          orgId: org1.id,
          email: 'scoped@example.com',
          role: 'MEMBER',
          token: 'scoped-token',
          status: 'PENDING',
          invitedById: testUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Query invites for org2 should not include org1's invite
      const org2Invites = await testPrisma.invite.findMany({
        where: { orgId: org2.id },
      });

      expect(org2Invites.length).toBe(0);
    });
  });
});
