/**
 * Domain Verification API Tests
 *
 * Tests for enterprise domain verification:
 * - GET verification status and instructions
 * - POST domain verification via DNS TXT lookup
 * - Authorization and access control
 * - Error handling
 * - Security
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import dns from 'dns/promises';

// Mock dependencies before imports
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    org: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/authz/cedar', () => ({
  isAuthorized: vi.fn(() => ({ isAuthorized: true, reason: 'Allowed' })),
  buildPrincipalFromSession: vi.fn(() => ({
    type: 'User',
    id: 'user-1',
    attributes: { isAuthenticated: true, membershipOrgIds: ['org-1'] },
  })),
  CedarActions: {
    ManageOrg: 'ManageOrg',
  },
}));

vi.mock('dns/promises', () => ({
  default: {
    resolveTxt: vi.fn(),
  },
}));

// Import after mocks
import { GET, POST } from '../route';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAuthorized } from '@/lib/authz/cedar';

const mockAuth = auth as Mock;
const mockFindUniqueOrg = prisma.org.findUnique as Mock;
const mockUpdateOrg = prisma.org.update as Mock;
const mockFindFirstMembership = prisma.membership.findFirst as Mock;
const mockFindManyMemberships = prisma.membership.findMany as Mock;
const mockIsAuthorized = isAuthorized as Mock;
const mockResolveTxt = dns.resolveTxt as Mock;

// Helper to create request
function createRequest(method: 'GET' | 'POST') {
  return new NextRequest(`http://localhost/api/org/org-1/verify-domain`, {
    method,
  });
}

function createParams(orgId: string) {
  return { params: Promise.resolve({ orgId }) };
}

// Test data
const enterpriseOrg = {
  id: 'org-1',
  name: 'Enterprise Corp',
  domain: 'enterprise.com',
  plan: 'ENTERPRISE',
  domainVerified: false,
  verificationToken: 'expertai-verify-abc123xyz',
};

const authenticatedSession = {
  user: { id: 'user-1', email: 'admin@enterprise.com' },
};

describe('GET /api/org/[orgId]/verify-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(authenticatedSession);
    mockFindUniqueOrg.mockResolvedValue(enterpriseOrg);
    mockFindFirstMembership.mockResolvedValue({ role: 'ADMIN' });
  });

  it('returns verification status for enterprise org', async () => {
    const response = await GET(createRequest('GET'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.domain).toBe('enterprise.com');
    expect(data.isVerified).toBe(false);
    expect(data.verificationToken).toBe('expertai-verify-abc123xyz');
  });

  it('includes DNS instructions', async () => {
    const response = await GET(createRequest('GET'), createParams('org-1'));
    const data = await response.json();

    expect(data.instructions).toBeDefined();
    expect(data.instructions.recordType).toBe('TXT');
    expect(data.instructions.recordName).toBe('_expertai-verify.enterprise.com');
    expect(data.instructions.recordValue).toBe('expertai-verify-abc123xyz');
  });

  it('generates token if not exists', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, verificationToken: null });
    mockUpdateOrg.mockResolvedValue({ ...enterpriseOrg });

    const response = await GET(createRequest('GET'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.verificationToken).toMatch(/^expertai-verify-/);
    expect(mockUpdateOrg).toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated users', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), createParams('org-1'));

    expect(response.status).toBe(401);
  });

  it('returns 404 for non-existent org', async () => {
    mockFindUniqueOrg.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), createParams('unknown-org'));

    expect(response.status).toBe(404);
  });

  it('returns 403 for non-members', async () => {
    mockFindFirstMembership.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), createParams('org-1'));

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Not a member');
  });

  it('returns 403 for non-admin members', async () => {
    mockFindFirstMembership.mockResolvedValue({ role: 'MEMBER' });

    const response = await GET(createRequest('GET'), createParams('org-1'));

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Admin access required');
  });

  it('returns 400 for non-enterprise plans', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, plan: 'PRO' });

    const response = await GET(createRequest('GET'), createParams('org-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Enterprise');
  });
});

describe('POST /api/org/[orgId]/verify-domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(authenticatedSession);
    mockFindManyMemberships.mockResolvedValue([{ orgId: 'org-1', role: 'ADMIN' }]);
    mockFindUniqueOrg.mockResolvedValue(enterpriseOrg);
    mockIsAuthorized.mockReturnValue({ isAuthorized: true, reason: 'Allowed' });
  });

  it('verifies domain when DNS record matches', async () => {
    mockResolveTxt.mockResolvedValue([['expertai-verify-abc123xyz']]);
    mockUpdateOrg.mockResolvedValue({ ...enterpriseOrg, domainVerified: true });

    const response = await POST(createRequest('POST'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isVerified).toBe(true);
    expect(mockUpdateOrg).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { domainVerified: true },
    });
  });

  it('returns failure when DNS record not found', async () => {
    const dnsError = new Error('ENOTFOUND');
    mockResolveTxt.mockRejectedValue(dnsError);

    const response = await POST(createRequest('POST'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.isVerified).toBe(false);
    expect(data.message).toContain('not found');
  });

  it('returns failure when token does not match', async () => {
    mockResolveTxt.mockResolvedValue([['wrong-token']]);

    const response = await POST(createRequest('POST'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.isVerified).toBe(false);
    expect(data.message).toContain('mismatch');
    expect(data.foundValues).toContain('wrong-token');
  });

  it('returns success for already verified domain', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, domainVerified: true });

    const response = await POST(createRequest('POST'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isVerified).toBe(true);
    expect(data.message).toContain('already verified');
    expect(mockResolveTxt).not.toHaveBeenCalled();
  });

  it('returns 401 for unauthenticated users', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(createRequest('POST'), createParams('org-1'));

    expect(response.status).toBe(401);
  });

  it('returns 403 for unauthorized users', async () => {
    mockIsAuthorized.mockReturnValue({ isAuthorized: false, reason: 'Not authorized' });

    const response = await POST(createRequest('POST'), createParams('org-1'));

    expect(response.status).toBe(403);
  });

  it('returns 404 for non-existent org', async () => {
    mockFindUniqueOrg.mockResolvedValue(null);

    const response = await POST(createRequest('POST'), createParams('unknown-org'));

    expect(response.status).toBe(404);
  });

  it('returns 400 for non-enterprise plans', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, plan: 'PRO' });

    const response = await POST(createRequest('POST'), createParams('org-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Enterprise');
  });

  it('returns 400 when domain is not set', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, domain: null });

    const response = await POST(createRequest('POST'), createParams('org-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('domain is not set');
  });

  it('returns 400 when verification token missing', async () => {
    mockFindUniqueOrg.mockResolvedValue({ ...enterpriseOrg, verificationToken: null });

    const response = await POST(createRequest('POST'), createParams('org-1'));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('No verification token');
  });

  it('handles multi-part TXT records', async () => {
    // Some DNS providers split long TXT records
    mockResolveTxt.mockResolvedValue([
      ['part1', 'part2'],
      ['expertai-verify-abc123xyz'],
    ]);
    mockUpdateOrg.mockResolvedValue({ ...enterpriseOrg, domainVerified: true });

    const response = await POST(createRequest('POST'), createParams('org-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isVerified).toBe(true);
  });
});

describe('Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(authenticatedSession);
    mockFindManyMemberships.mockResolvedValue([{ orgId: 'org-1', role: 'ADMIN' }]);
    mockFindUniqueOrg.mockResolvedValue(enterpriseOrg);
    mockFindFirstMembership.mockResolvedValue({ role: 'ADMIN' });
    mockIsAuthorized.mockReturnValue({ isAuthorized: true, reason: 'Allowed' });
  });

  it('does not expose internal org details in GET response', async () => {
    const response = await GET(createRequest('GET'), createParams('org-1'));
    const data = await response.json();

    expect(data).not.toHaveProperty('ssoConfig');
    expect(data).not.toHaveProperty('stripeCustomerId');
    expect(data).not.toHaveProperty('createdAt');
  });

  it('calls Cedar authorization in POST', async () => {
    mockResolveTxt.mockResolvedValue([['expertai-verify-abc123xyz']]);
    mockUpdateOrg.mockResolvedValue({ ...enterpriseOrg, domainVerified: true });

    await POST(createRequest('POST'), createParams('org-1'));

    expect(mockIsAuthorized).toHaveBeenCalled();
  });
});
