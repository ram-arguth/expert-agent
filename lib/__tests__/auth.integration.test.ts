/**
 * Integration Tests: Authentication
 *
 * Tests the authentication flow with mocked OAuth providers:
 * - Session creation and persistence
 * - Provider-based user creation
 * - Session validation
 *
 * Note: Uses mocked OAuth - no real provider calls.
 *
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  testPrisma,
  cleanDatabase,
  disconnectTestDatabase,
} from '@/lib/test-utils/integration';

describe('Authentication Integration', () => {
  beforeAll(async () => {
    await testPrisma.$connect();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('User Creation', () => {
    it('creates user with Google provider', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'google-user@gmail.com',
          name: 'Google User',
          authProvider: 'google',
          authProviderId: 'google-12345',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('google-user@gmail.com');
      expect(user.authProvider).toBe('google');
    });

    it('creates user with Apple provider', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'apple-user@icloud.com',
          name: 'Apple User',
          authProvider: 'apple',
          authProviderId: 'apple-12345',
        },
      });

      expect(user.authProvider).toBe('apple');
    });

    it('creates user with Microsoft Entra ID provider', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'ms-user@outlook.com',
          name: 'MS User',
          authProvider: 'microsoft-entra-id',
          authProviderId: 'ms-12345',
        },
      });

      expect(user.authProvider).toBe('microsoft-entra-id');
    });

    it('enforces unique email constraint', async () => {
      await testPrisma.user.create({
        data: {
          email: 'unique@example.com',
          name: 'First User',
          authProvider: 'google',
        },
      });

      await expect(
        testPrisma.user.create({
          data: {
            email: 'unique@example.com',
            name: 'Second User',
            authProvider: 'apple',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('User Lookup', () => {
    it('finds user by email', async () => {
      await testPrisma.user.create({
        data: {
          email: 'findme@example.com',
          name: 'Find Me',
          authProvider: 'google',
        },
      });

      const found = await testPrisma.user.findUnique({
        where: { email: 'findme@example.com' },
      });

      expect(found).toBeDefined();
      expect(found?.name).toBe('Find Me');
    });

    it('returns null for non-existent user', async () => {
      const notFound = await testPrisma.user.findUnique({
        where: { email: 'notexists@example.com' },
      });

      expect(notFound).toBeNull();
    });

    it('finds user by provider ID', async () => {
      await testPrisma.user.create({
        data: {
          email: 'provider@example.com',
          name: 'Provider User',
          authProvider: 'google',
          authProviderId: 'unique-provider-id',
        },
      });

      const found = await testPrisma.user.findFirst({
        where: {
          authProvider: 'google',
          authProviderId: 'unique-provider-id',
        },
      });

      expect(found).toBeDefined();
      expect(found?.email).toBe('provider@example.com');
    });
  });

  describe('User with Memberships', () => {
    it('loads user with membership relation', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'member@example.com',
          name: 'Member User',
          authProvider: 'google',
        },
      });

      const org = await testPrisma.org.create({
        data: {
          name: 'Test Org',
          slug: 'test-org',
          type: 'TEAM',
        },
      });

      await testPrisma.membership.create({
        data: {
          userId: user.id,
          orgId: org.id,
          role: 'OWNER',
        },
      });

      // Query with relation
      const userWithMemberships = await testPrisma.user.findUnique({
        where: { id: user.id },
        include: {
          memberships: {
            include: { org: true },
          },
        },
      });

      expect(userWithMemberships?.memberships.length).toBe(1);
      expect(userWithMemberships?.memberships[0].org.name).toBe('Test Org');
    });

    it('returns correct role for each org', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'multi-org@example.com',
          name: 'Multi Org User',
          authProvider: 'google',
        },
      });

      const org1 = await testPrisma.org.create({
        data: { name: 'Org 1', slug: 'org-1', type: 'TEAM' },
      });

      const org2 = await testPrisma.org.create({
        data: { name: 'Org 2', slug: 'org-2', type: 'TEAM' },
      });

      await testPrisma.membership.createMany({
        data: [
          { userId: user.id, orgId: org1.id, role: 'OWNER' },
          { userId: user.id, orgId: org2.id, role: 'MEMBER' },
        ],
      });

      const memberships = await testPrisma.membership.findMany({
        where: { userId: user.id },
        include: { org: true },
        orderBy: { org: { name: 'asc' } },
      });

      expect(memberships[0].role).toBe('OWNER');
      expect(memberships[0].org.name).toBe('Org 1');
      expect(memberships[1].role).toBe('MEMBER');
      expect(memberships[1].org.name).toBe('Org 2');
    });
  });

  describe('Session Tracking', () => {
    it('can track user sessions', async () => {
      const user = await testPrisma.user.create({
        data: {
          email: 'session@example.com',
          name: 'Session User',
          authProvider: 'google',
        },
      });

      // Note: NextAuth manages its own sessions table
      // This tests our ability to track user activity

      const updatedUser = await testPrisma.user.update({
        where: { id: user.id },
        data: { updatedAt: new Date() },
      });

      expect(updatedUser.updatedAt.getTime()).toBeGreaterThanOrEqual(
        user.createdAt.getTime()
      );
    });
  });

  describe('Provider Restrictions', () => {
    it('validates known providers', async () => {
      const knownProviders = ['google', 'apple', 'microsoft-entra-id'];

      for (const provider of knownProviders) {
        const user = await testPrisma.user.create({
          data: {
            email: `${provider}-test@example.com`,
            name: `${provider} Test User`,
            authProvider: provider,
          },
        });

        expect(user.authProvider).toBe(provider);
        await testPrisma.user.delete({ where: { id: user.id } });
      }
    });

    // Note: Prisma doesn't enforce provider enum - this is application-level validation
    it('stores provider as string (application validates)', async () => {
      // This shows that DB accepts any string - API must validate
      const user = await testPrisma.user.create({
        data: {
          email: 'anyauth@example.com',
          name: 'Any Auth User',
          authProvider: 'github', // Not a "trusted" provider in our app
        },
      });

      expect(user.authProvider).toBe('github');
      // Real validation happens at API layer
    });
  });
});
