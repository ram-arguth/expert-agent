/**
 * Unit Tests: Invite API
 *
 * Tests for /api/org/[orgId]/invite and /api/invite/accept
 *
 * @see docs/IMPEMENTATION.md - Phase 1.4 Test Requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  createMockSession,
  createMockOrg,
  createMockMembership,
  createMockInvite,
  createMockUser,
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
    },
    user: {
      findUnique: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    invite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mocking
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { POST as createInvite, GET as listInvites, DELETE as revokeInvite } from '@/app/api/org/[orgId]/invite/route';
import { POST as acceptInvite, GET as getInviteInfo } from '@/app/api/invite/accept/route';

// Cast to mockable functions
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  org: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  membership: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  invite: { 
    findUnique: ReturnType<typeof vi.fn>; 
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe('POST /api/org/[orgId]/invite - Create Invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  const createContext = (orgId: string) => ({
    params: Promise.resolve({ orgId }),
  });

  it('creates invite when user is org owner', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockMembership = createMockMembership({ role: 'OWNER', orgId: mockOrg.id });
    const mockCreatedInvite = createMockInvite({ orgId: mockOrg.id });

    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
    mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
    mockPrisma.invite.findFirst.mockResolvedValue(null); // No existing invite
    mockPrisma.invite.create.mockResolvedValue(mockCreatedInvite);

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com', role: 'MEMBER' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.email).toBe(mockCreatedInvite.email);
    expect(data.role).toBe('MEMBER');
    expect(data.inviteLink).toContain('token=');
    expect(mockPrisma.invite.create).toHaveBeenCalled();
  });

  it('creates invite when user is org admin', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockMembership = createMockMembership({ role: 'ADMIN', orgId: mockOrg.id });
    const mockCreatedInvite = createMockInvite({ orgId: mockOrg.id });

    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.invite.findFirst.mockResolvedValue(null);
    mockPrisma.invite.create.mockResolvedValue(mockCreatedInvite);

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    expect(response.status).toBe(201);
  });

  it('returns 403 when user is only member', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockMembership = createMockMembership({ role: 'MEMBER', orgId: mockOrg.id });

    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('returns 404 when org does not exist', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    mockPrisma.org.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/org/nonexistent/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'newuser@example.com' }),
    });

    const response = await createInvite(request, createContext('nonexistent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
  });

  it('returns 409 when user is already a member', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockMembership = createMockMembership({ role: 'OWNER', orgId: mockOrg.id });
    const existingUser = createMockUser({ email: 'existing@example.com' });

    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique
      .mockResolvedValueOnce(mockMembership) // Caller's membership
      .mockResolvedValueOnce({ ...mockMembership, userId: existingUser.id }); // Target user's membership
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing@example.com' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain('already a member');
  });

  it('returns 409 when pending invite exists', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockMembership = createMockMembership({ role: 'OWNER', orgId: mockOrg.id });
    const existingInvite = createMockInvite({ email: 'pending@example.com', orgId: mockOrg.id });

    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.invite.findFirst.mockResolvedValue(existingInvite);

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pending@example.com' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain('pending invite');
  });

  it('returns 400 for invalid email format', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    mockPrisma.org.findUnique.mockResolvedValue(mockOrg);
    mockPrisma.membership.findUnique.mockResolvedValue(
      createMockMembership({ role: 'OWNER', orgId: mockOrg.id })
    );

    const request = new NextRequest('http://localhost:3000/api/org/test/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const response = await createInvite(request, createContext(mockOrg.id));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation Error');
  });
});

describe('GET /api/org/[orgId]/invite - List Invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  const createContext = (orgId: string) => ({
    params: Promise.resolve({ orgId }),
  });

  it('lists pending invites for org owner', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    const mockMembership = createMockMembership({ role: 'OWNER' });
    const mockInvites = [
      createMockInvite({ email: 'invite1@example.com' }),
      createMockInvite({ email: 'invite2@example.com' }),
    ];

    mockPrisma.membership.findUnique.mockResolvedValue(mockMembership);
    mockPrisma.invite.findMany.mockResolvedValue(
      mockInvites.map((i) => ({ ...i, invitedBy: { name: 'Test', email: 'test@example.com' } }))
    );

    const request = new NextRequest('http://localhost:3000/api/org/test/invite');
    const response = await listInvites(request, createContext('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invites).toHaveLength(2);
  });

  it('returns 403 for non-admin member', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    mockPrisma.membership.findUnique.mockResolvedValue(
      createMockMembership({ role: 'MEMBER' })
    );

    const request = new NextRequest('http://localhost:3000/api/org/test/invite');
    const response = await listInvites(request, createContext('org-1'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });
});

describe('DELETE /api/org/[orgId]/invite - Revoke Invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  const createContext = (orgId: string) => ({
    params: Promise.resolve({ orgId }),
  });

  it('revokes invite for org admin', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    mockPrisma.membership.findUnique.mockResolvedValue(
      createMockMembership({ role: 'ADMIN' })
    );
    mockPrisma.invite.updateMany.mockResolvedValue({ count: 1 });

    const request = new NextRequest(
      'http://localhost:3000/api/org/org-1/invite?inviteId=invite-1'
    );
    const response = await revokeInvite(request, createContext('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('revoked');
  });

  it('returns 404 when invite not found', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    mockPrisma.membership.findUnique.mockResolvedValue(
      createMockMembership({ role: 'OWNER' })
    );
    mockPrisma.invite.updateMany.mockResolvedValue({ count: 0 });

    const request = new NextRequest(
      'http://localhost:3000/api/org/org-1/invite?inviteId=nonexistent'
    );
    const response = await revokeInvite(request, createContext('org-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
  });

  it('returns 400 when inviteId missing', async () => {
    const session = createMockSession();
    mockAuth.mockResolvedValue(session);

    const request = new NextRequest('http://localhost:3000/api/org/org-1/invite');
    const response = await revokeInvite(request, createContext('org-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Bad Request');
  });
});

describe('POST /api/invite/accept - Accept Invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  it('creates membership when accepting valid invite', async () => {
    const session = createMockSession({ email: 'invitee@example.com', provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockOrg = createMockOrg();
    const mockInvite = createMockInvite({
      email: 'invitee@example.com',
      orgId: mockOrg.id,
      status: 'PENDING',
    });

    mockPrisma.invite.findUnique.mockResolvedValue({ ...mockInvite, org: mockOrg });
    mockPrisma.membership.findUnique.mockResolvedValue(null); // Not already a member
    mockPrisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        membership: { create: vi.fn().mockResolvedValue(createMockMembership()) },
        invite: { update: vi.fn().mockResolvedValue({ ...mockInvite, status: 'ACCEPTED' }) },
      };
      return callback(tx);
    });

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: mockInvite.token }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toContain('joined');
    expect(data.org).toBeDefined();
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('returns 403 for non-trusted provider', async () => {
    const session = createMockSession({ provider: 'github' });
    mockAuth.mockResolvedValue(session);

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'some-token' }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain('Google, Apple, or Microsoft');
  });

  it('returns 404 for invalid token', async () => {
    const session = createMockSession({ provider: 'google' });
    mockAuth.mockResolvedValue(session);

    mockPrisma.invite.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
  });

  it('returns 409 for already accepted invite', async () => {
    const session = createMockSession({ email: 'invitee@example.com', provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockInvite = createMockInvite({
      email: 'invitee@example.com',
      status: 'ACCEPTED',
    });

    mockPrisma.invite.findUnique.mockResolvedValue({ ...mockInvite, org: createMockOrg() });

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: mockInvite.token }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toContain('accepted');
  });

  it('returns 410 for expired invite', async () => {
    const session = createMockSession({ email: 'invitee@example.com', provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1); // Expired yesterday

    const mockInvite = createMockInvite({
      email: 'invitee@example.com',
      expiresAt: expiredDate,
    });

    mockPrisma.invite.findUnique.mockResolvedValue({ ...mockInvite, org: createMockOrg() });
    mockPrisma.invite.update.mockResolvedValue({ ...mockInvite, status: 'EXPIRED' });

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: mockInvite.token }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.message).toContain('expired');
  });

  it('returns 403 when email does not match', async () => {
    const session = createMockSession({ email: 'wrong@example.com', provider: 'google' });
    mockAuth.mockResolvedValue(session);

    const mockInvite = createMockInvite({ email: 'correct@example.com' });
    mockPrisma.invite.findUnique.mockResolvedValue({ ...mockInvite, org: createMockOrg() });

    const request = new NextRequest('http://localhost:3000/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: mockInvite.token }),
    });

    const response = await acceptInvite(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toContain('different email');
  });
});

describe('GET /api/invite/accept - Get Invite Info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockCounters();
  });

  it('returns invite info for valid token (no auth required)', async () => {
    const mockInvite = createMockInvite({ email: 'invitee@example.com' });
    const mockOrg = createMockOrg();

    mockPrisma.invite.findUnique.mockResolvedValue({
      ...mockInvite,
      org: { name: mockOrg.name, slug: mockOrg.slug },
      invitedBy: { name: 'Inviter' },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/invite/accept?token=${mockInvite.token}`
    );

    const response = await getInviteInfo(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe('invitee@example.com');
    expect(data.orgName).toBe(mockOrg.name);
    expect(data.isValid).toBe(true);
  });

  it('returns 404 for invalid token', async () => {
    mockPrisma.invite.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/invite/accept?token=invalid'
    );

    const response = await getInviteInfo(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
  });

  it('marks invite as expired in response', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);

    const mockInvite = createMockInvite({ expiresAt: expiredDate });

    mockPrisma.invite.findUnique.mockResolvedValue({
      ...mockInvite,
      org: { name: 'Test Org', slug: 'test-org' },
      invitedBy: { name: 'Inviter' },
    });

    const request = new NextRequest(
      `http://localhost:3000/api/invite/accept?token=${mockInvite.token}`
    );

    const response = await getInviteInfo(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('EXPIRED');
    expect(data.isValid).toBe(false);
  });
});
