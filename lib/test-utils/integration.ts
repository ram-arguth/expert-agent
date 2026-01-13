/**
 * Integration Test Setup
 *
 * Sets up test database and utilities for integration tests.
 * Uses a separate test database to avoid affecting development data.
 */

import { PrismaClient } from '@prisma/client';

// Use test database (configured via DATABASE_URL in CI)
export const testPrisma = new PrismaClient({
  log: ['error'],
});

// Clean up database before tests
export async function cleanDatabase() {
  const tablenames = await testPrisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    try {
      await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch (error) {
      console.log('Could not truncate tables, they may not exist yet');
    }
  }
}

// Seed test data
export async function seedTestData() {
  // Create a test user
  const testUser = await testPrisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      authProvider: 'google',
      authProviderId: 'google-123',
    },
  });

  // Create a test org
  const testOrg = await testPrisma.org.create({
    data: {
      name: 'Test Organization',
      slug: 'test-org',
      type: 'TEAM',
    },
  });

  // Create owner membership
  await testPrisma.membership.create({
    data: {
      userId: testUser.id,
      orgId: testOrg.id,
      role: 'OWNER',
    },
  });

  return { testUser, testOrg };
}

// Disconnect after tests
export async function disconnectTestDatabase() {
  await testPrisma.$disconnect();
}
