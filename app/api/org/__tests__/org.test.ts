/**
 * Unit Tests: Organization API
 *
 * Tests for POST /api/org (create team) and GET /api/org (list orgs)
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Test Requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createMockSession,
  createMockOrg,
  createMockMembership,
  resetMockCounters,
} from '@/lib/test-utils';

// Define mocks at module level (hoisted)
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    org: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    membership: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mocking
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { POST, GET } from '../route';

// Cast to mockable functions
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  org: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  membership: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('POST /api/org - Create Team', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates team with owner membership for authenticated user', async () => {
    // Arrange
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg({ name: 'My Team', slug: 'my-team' });

    mockPrisma.org.findUnique.mockResolvedValue(null); // slug not taken
    mockPrisma.membership.count.mockResolvedValue(0); // no existing owned orgs
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        org: { create: vi.fn().mockResolvedValue(mockOrg) },
        membership: { create: vi.fn().mockResolvedValue(createMockMembership({ role: 'OWNER' })) },
      };
      return callback(tx);
    });

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    // Act
    const response = await POST(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(data.name).toBe('My Team');
    expect(data.slug).toBeDefined();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated user', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 for non-Google/Apple/Microsoft provider', async () => {
    const session = createMockSession({ provider: 'github' });
    mockAuth.mockResolvedValue(session);

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(data.message).toContain('Google, Apple, or Microsoft');
  });

  it('returns 400 for invalid org name', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'A' }), // Too short
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
  });

  it('returns 409 if slug already exists', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const existingOrg = createMockOrg();
    mockPrisma.org.findUnique.mockResolvedValue(existingOrg); // slug taken
    mockPrisma.membership.count.mockResolvedValue(0);

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team', slug: existingOrg.slug }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Conflict');
  });

  it('returns 400 if user owns too many orgs', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    mockPrisma.org.findUnique.mockResolvedValue(null);
    mockPrisma.membership.count.mockResolvedValue(5); // At limit

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Team' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Limit Exceeded');
  });

  it('accepts Apple provider', async () => {
    const session = createMockSession({ provider: 'apple' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    mockPrisma.org.findUnique.mockResolvedValue(null);
    mockPrisma.membership.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        org: { create: vi.fn().mockResolvedValue(mockOrg) },
        membership: { create: vi.fn().mockResolvedValue(createMockMembership({ role: 'OWNER' })) },
      };
      return callback(tx);
    });

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Apple Team' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it('accepts Microsoft provider', async () => {
    const session = createMockSession({ provider: 'microsoft-entra-id' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    mockPrisma.org.findUnique.mockResolvedValue(null);
    mockPrisma.membership.count.mockResolvedValue(0);
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        org: { create: vi.fn().mockResolvedValue(mockOrg) },
        membership: { create: vi.fn().mockResolvedValue(createMockMembership({ role: 'OWNER' })) },
      };
      return callback(tx);
    });

    const request = new NextRequest('http://localhost:3000/api/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Microsoft Team' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});

describe('GET /api/org - List Organizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  it('returns user organizations with roles', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    const org1 = createMockOrg({ name: 'Team Alpha' });
    const org2 = createMockOrg({ name: 'Team Beta' });

    mockPrisma.membership.findMany.mockResolvedValue([
      { ...createMockMembership({ role: 'OWNER', orgId: org1.id }), org: org1 },
      { ...createMockMembership({ role: 'MEMBER', orgId: org2.id }), org: org2 },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.organizations).toHaveLength(2);
    expect(data.organizations[0].role).toBe('OWNER');
    expect(data.organizations[1].role).toBe('MEMBER');
  });

  it('returns 401 for unauthenticated user', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns empty array for user with no orgs', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);
    mockPrisma.membership.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.organizations).toEqual([]);
  });
});
