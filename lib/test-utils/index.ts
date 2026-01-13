/**
 * Test Utilities for API Testing
 *
 * Provides mocks for Prisma, NextAuth, and common test fixtures.
 */

import { vi } from 'vitest';

// ============================================
// Session Types
// ============================================

export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    provider?: string;
    image?: string | null;
  };
  expires: string;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
  authProvider: string;
  authProviderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockOrg {
  id: string;
  name: string;
  slug: string;
  type: 'TEAM' | 'ENTERPRISE';
  plan: string;
  domain?: string | null;
  domainVerified: boolean;
  tokensRemaining: number;
  tokensMonthly: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockMembership {
  id: string;
  userId: string;
  orgId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'AUDITOR' | 'BILLING_MANAGER';
  createdAt: Date;
  updatedAt: Date;
}

export interface MockInvite {
  id: string;
  orgId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'AUDITOR' | 'BILLING_MANAGER';
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  invitedById: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date | null;
}

// ============================================
// Mock Factories
// ============================================

let userIdCounter = 0;
let orgIdCounter = 0;
let membershipIdCounter = 0;
let inviteIdCounter = 0;

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  userIdCounter++;
  return {
    id: `user-${userIdCounter}`,
    email: `user${userIdCounter}@example.com`,
    name: `Test User ${userIdCounter}`,
    authProvider: 'google',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockOrg(overrides: Partial<MockOrg> = {}): MockOrg {
  orgIdCounter++;
  return {
    id: `org-${orgIdCounter}`,
    name: `Test Org ${orgIdCounter}`,
    slug: `test-org-${orgIdCounter}`,
    type: 'TEAM',
    plan: 'free',
    domain: null,
    domainVerified: false,
    tokensRemaining: 1000,
    tokensMonthly: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockMembership(
  overrides: Partial<MockMembership> = {}
): MockMembership {
  membershipIdCounter++;
  return {
    id: `membership-${membershipIdCounter}`,
    userId: `user-1`,
    orgId: `org-1`,
    role: 'MEMBER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockInvite(overrides: Partial<MockInvite> = {}): MockInvite {
  inviteIdCounter++;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    id: `invite-${inviteIdCounter}`,
    orgId: `org-1`,
    email: `invitee${inviteIdCounter}@example.com`,
    role: 'MEMBER',
    token: `test-token-${inviteIdCounter}-${Math.random().toString(36).substring(2)}`,
    status: 'PENDING',
    invitedById: `user-1`,
    createdAt: new Date(),
    expiresAt,
    acceptedAt: null,
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<MockSession['user']> = {}): MockSession {
  return {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      provider: 'google',
      image: null,
      ...overrides,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ============================================
// Reset Utilities
// ============================================

export function resetMockCounters() {
  userIdCounter = 0;
  orgIdCounter = 0;
  membershipIdCounter = 0;
  inviteIdCounter = 0;
}

// ============================================
// Prisma Mock
// ============================================

export type MockPrismaClient = {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  org: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  membership: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  invite: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

export function createMockPrisma(): MockPrismaClient {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    org: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    invite: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback({
      org: {
        create: vi.fn(),
      },
      membership: {
        create: vi.fn(),
      },
      invite: {
        update: vi.fn(),
      },
    })),
  };
}

// ============================================
// NextRequest Mock
// ============================================

export function createMockRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
): Request {
  const url = new URL('http://localhost:3000/api/test');
  
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  return new Request(url.toString(), init);
}
