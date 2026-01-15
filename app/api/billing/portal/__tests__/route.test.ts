/**
 * Stripe Customer Portal API Tests
 *
 * Tests for the portal session creation:
 * - Portal session creation
 * - Authentication
 * - Authorization
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    org: {
      findUnique: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

// Hoist Stripe mock functions
const { mockPortalSessionCreate } = vi.hoisted(() => ({
  mockPortalSessionCreate: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      billingPortal = { sessions: { create: mockPortalSessionCreate } };
    },
  };
});

// Import after mocks
import { POST } from '../route';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as Mock;
const mockOrgFindUnique = prisma.org.findUnique as Mock;
const mockMembershipFindFirst = prisma.membership.findFirst as Mock;

// Helper to create request
function createRequest(body: object) {
  return new NextRequest('http://localhost/api/billing/portal', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Test data
const authenticatedSession = {
  user: { id: 'user-1', email: 'user@example.com', name: 'Test User' },
};

const mockPortalSession = {
  url: 'https://billing.stripe.com/session/xyz',
};

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(authenticatedSession);
    mockMembershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
    mockOrgFindUnique.mockResolvedValue({
      stripeCustomerId: 'cus_org123',
      name: 'Test Org',
    });
    mockPortalSessionCreate.mockResolvedValue(mockPortalSession);
  });

  describe('Portal Session Creation', () => {
    it('creates portal session with return URL', async () => {
      const response = await POST(createRequest({ orgId: 'org-1' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe('https://billing.stripe.com/session/xyz');
    });

    it('uses correct Stripe customer ID', async () => {
      await POST(createRequest({ orgId: 'org-1' }));

      expect(mockPortalSessionCreate).toHaveBeenCalledWith({
        customer: 'cus_org123',
        return_url: expect.stringContaining('/settings/billing'),
      });
    });
  });

  describe('Validation', () => {
    it('returns 400 if orgId is missing', async () => {
      const response = await POST(createRequest({}));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('orgId');
    });

    it('returns 400 if org has no Stripe customer', async () => {
      mockOrgFindUnique.mockResolvedValue({
        stripeCustomerId: null,
        name: 'Test Org',
      });

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('active subscription');
    });
  });

  describe('Authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(401);
    });

    it('returns 401 for session without user ID', async () => {
      mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } });

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    it('allows ADMIN to access portal', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'ADMIN' });

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(200);
    });

    it('allows OWNER to access portal', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'OWNER' });

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(200);
    });

    it('allows BILLING_MANAGER to access portal', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'BILLING_MANAGER' });

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(200);
    });

    it('returns 403 for regular members', async () => {
      mockMembershipFindFirst.mockResolvedValue(null);

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Not authorized');
    });

    it('returns 404 for non-existent org', async () => {
      mockOrgFindUnique.mockResolvedValue(null);

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('handles Stripe API errors', async () => {
      const stripeError = new Error('Stripe error') as Error & { type: string; statusCode?: number };
      stripeError.type = 'StripeAPIError';
      stripeError.statusCode = 500;
      mockPortalSessionCreate.mockRejectedValue(stripeError);

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Stripe error');
    });

    it('handles database errors gracefully', async () => {
      mockMembershipFindFirst.mockRejectedValue(new Error('DB error'));

      const response = await POST(createRequest({ orgId: 'org-1' }));

      expect(response.status).toBe(500);
    });
  });
});
