/**
 * Stripe Checkout API Tests
 *
 * Tests for the checkout session creation:
 * - Session creation
 * - priceId validation
 * - Success/cancel URLs
 * - Authentication
 * - Organization billing
 * - Security
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    org: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
    },
  },
}));

// Hoist Stripe mock functions before they are used
const { mockCustomersCreate, mockCheckoutCreate } = vi.hoisted(() => ({
  mockCustomersCreate: vi.fn(),
  mockCheckoutCreate: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      customers = { create: mockCustomersCreate };
      checkout = { sessions: { create: mockCheckoutCreate } };
    },
  };
});

// Import after mocks
import { POST } from '../route';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as Mock;
const mockUserFindUnique = prisma.user.findUnique as Mock;
const mockUserUpdate = prisma.user.update as Mock;
const mockOrgFindUnique = prisma.org.findUnique as Mock;
const mockOrgUpdate = prisma.org.update as Mock;
const mockMembershipFindFirst = prisma.membership.findFirst as Mock;

// Helper to create request
function createRequest(body: object) {
  return new NextRequest('http://localhost/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Test data
const authenticatedSession = {
  user: { id: 'user-1', email: 'user@example.com', name: 'Test User' },
};

const mockCheckoutSession = {
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/pay/cs_test_123',
};

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(authenticatedSession);
    mockUserFindUnique.mockResolvedValue({
      stripeCustomerId: 'cus_existing',
      email: 'user@example.com',
      name: 'Test User',
    });
    mockCheckoutCreate.mockResolvedValue(mockCheckoutSession);
  });

  describe('Session Creation', () => {
    it('creates Stripe Checkout session', async () => {
      const response = await POST(createRequest({ priceId: 'price_pro_monthly' }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('cs_test_123');
      expect(data.url).toContain('checkout.stripe.com');
    });

    it('uses existing Stripe customer ID', async () => {
      await POST(createRequest({ priceId: 'price_pro_monthly' }));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing',
        })
      );
    });

    it('creates new Stripe customer if none exists', async () => {
      mockUserFindUnique.mockResolvedValue({
        stripeCustomerId: null,
        email: 'user@example.com',
        name: 'Test User',
      });
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new' });
      mockUserUpdate.mockResolvedValue({});

      await POST(createRequest({ priceId: 'price_pro_monthly' }));

      expect(mockCustomersCreate).toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stripeCustomerId: 'cus_new' },
      });
    });
  });

  describe('Price Validation', () => {
    it('returns 400 if priceId is missing', async () => {
      const response = await POST(createRequest({}));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('priceId');
    });

    it('accepts valid priceId', async () => {
      const response = await POST(createRequest({ priceId: 'price_test_123' }));

      expect(response.status).toBe(200);
    });
  });

  describe('Success/Cancel URLs', () => {
    it('sets success URL with session ID placeholder', async () => {
      await POST(createRequest({ priceId: 'price_pro_monthly' }));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining('{CHECKOUT_SESSION_ID}'),
        })
      );
    });

    it('sets cancel URL', async () => {
      await POST(createRequest({ priceId: 'price_pro_monthly' }));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          cancel_url: expect.stringContaining('/billing/cancel'),
        })
      );
    });
  });

  describe('Authentication', () => {
    it('returns 401 for unauthenticated users', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await POST(createRequest({ priceId: 'price_pro' }));

      expect(response.status).toBe(401);
    });

    it('returns 401 for session without user ID', async () => {
      mockAuth.mockResolvedValue({ user: { email: 'test@example.com' } });

      const response = await POST(createRequest({ priceId: 'price_pro' }));

      expect(response.status).toBe(401);
    });
  });

  describe('Organization Billing', () => {
    it('allows org admin to create checkout for org', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
      mockOrgFindUnique.mockResolvedValue({
        stripeCustomerId: 'cus_org',
        name: 'Test Org',
      });

      const response = await POST(
        createRequest({ priceId: 'price_enterprise', orgId: 'org-1' })
      );

      expect(response.status).toBe(200);
      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_org',
        })
      );
    });

    it('allows org owner to create checkout for org', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'OWNER' });
      mockOrgFindUnique.mockResolvedValue({
        stripeCustomerId: 'cus_org',
        name: 'Test Org',
      });

      const response = await POST(
        createRequest({ priceId: 'price_enterprise', orgId: 'org-1' })
      );

      expect(response.status).toBe(200);
    });

    it('returns 403 for non-admin org member', async () => {
      mockMembershipFindFirst.mockResolvedValue(null);

      const response = await POST(
        createRequest({ priceId: 'price_enterprise', orgId: 'org-1' })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Not authorized');
    });

    it('creates new Stripe customer for org if none exists', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
      mockOrgFindUnique.mockResolvedValue({
        stripeCustomerId: null,
        name: 'Test Org',
      });
      mockCustomersCreate.mockResolvedValue({ id: 'cus_new_org' });
      mockOrgUpdate.mockResolvedValue({});

      await POST(createRequest({ priceId: 'price_enterprise', orgId: 'org-1' }));

      expect(mockCustomersCreate).toHaveBeenCalled();
      expect(mockOrgUpdate).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { stripeCustomerId: 'cus_new_org' },
      });
    });
  });

  describe('Metadata', () => {
    it('includes userId in checkout metadata', async () => {
      await POST(createRequest({ priceId: 'price_pro_monthly' }));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('includes orgId in checkout metadata when provided', async () => {
      mockMembershipFindFirst.mockResolvedValue({ role: 'ADMIN' });
      mockOrgFindUnique.mockResolvedValue({
        stripeCustomerId: 'cus_org',
        name: 'Test Org',
      });

      await POST(createRequest({ priceId: 'price_enterprise', orgId: 'org-1' }));

      expect(mockCheckoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            orgId: 'org-1',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles Stripe API errors', async () => {
      const stripeError = new Error('Stripe error') as Error & { statusCode?: number };
      stripeError.statusCode = 400;
      mockCheckoutCreate.mockRejectedValue(stripeError);

      const response = await POST(createRequest({ priceId: 'price_pro' }));

      // Generic error handling since we can't use instanceof with mocked Stripe
      expect(response.status).toBe(500);
    });

    it('handles database errors gracefully', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('DB error'));

      const response = await POST(createRequest({ priceId: 'price_pro' }));

      expect(response.status).toBe(500);
    });
  });
});
