/**
 * Stripe Webhook API Tests
 *
 * Tests for the webhook handler:
 * - Signature verification
 * - Event handling
 * - Idempotency
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    stripeEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    org: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Hoist Stripe mock functions
const {
  mockConstructEvent,
  mockSubscriptionsRetrieve,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      webhooks = { constructEvent: mockConstructEvent };
      subscriptions = { retrieve: mockSubscriptionsRetrieve };
    },
  };
});

// Import after mocks
import { POST } from '../route';
import { prisma } from '@/lib/db';

const mockEventFindUnique = prisma.stripeEvent.findUnique as Mock;
const mockEventUpsert = prisma.stripeEvent.upsert as Mock;
const mockEventUpdate = prisma.stripeEvent.update as Mock;
const mockOrgFindFirst = prisma.org.findFirst as Mock;
const mockOrgUpdate = prisma.org.update as Mock;

// Helper to create request with signature
function createRequest(body: string, signature = 'valid_sig') {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
  });
}

// Mock events
const checkoutCompletedEvent = {
  id: 'evt_checkout_completed',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123',
      customer: 'cus_org123',
      subscription: 'sub_123',
      metadata: {
        userId: 'user-1',
        orgId: 'org-1',
      },
    },
  },
};

const invoiceSucceededEvent = {
  id: 'evt_invoice_succeeded',
  type: 'invoice.payment_succeeded',
  data: {
    object: {
      id: 'in_123',
      customer: 'cus_org123',
      subscription: 'sub_123',
    },
  },
};

const subscriptionDeletedEvent = {
  id: 'evt_subscription_deleted',
  type: 'customer.subscription.deleted',
  data: {
    object: {
      id: 'sub_123',
      customer: 'cus_org123',
    },
  },
};

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventFindUnique.mockResolvedValue(null);
    mockEventUpsert.mockResolvedValue({});
    mockEventUpdate.mockResolvedValue({});
  });

  describe('Signature Verification', () => {
    it('returns 400 if stripe-signature is missing', async () => {
      const request = new NextRequest('http://localhost/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing stripe-signature');
    });

    it('returns 400 for invalid signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await POST(createRequest('{}', 'invalid_sig'));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid signature');
    });
  });

  describe('Idempotency', () => {
    it('skips already processed events', async () => {
      mockConstructEvent.mockReturnValue(checkoutCompletedEvent);
      mockEventFindUnique.mockResolvedValue({ id: 'evt_checkout_completed', processed: true });

      const response = await POST(createRequest('valid_body'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(mockOrgUpdate).not.toHaveBeenCalled();
    });
  });

  describe('checkout.session.completed', () => {
    beforeEach(() => {
      mockConstructEvent.mockReturnValue(checkoutCompletedEvent);
      mockSubscriptionsRetrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
      });
      mockOrgUpdate.mockResolvedValue({});
    });

    it('updates org with Stripe customer and plan', async () => {
      const response = await POST(createRequest('valid_body'));

      expect(response.status).toBe(200);
      expect(mockOrgUpdate).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          stripeCustomerId: 'cus_org123',
        }),
      });
    });

    it('sets token quota based on plan', async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_enterprise_monthly' } }] },
      });

      await POST(createRequest('valid_body'));

      expect(mockOrgUpdate).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          tokensRemaining: expect.any(Number),
          tokensMonthly: expect.any(Number),
        }),
      });
    });
  });

  describe('invoice.payment_succeeded', () => {
    it('resets token quota for org', async () => {
      mockConstructEvent.mockReturnValue(invoiceSucceededEvent);
      mockOrgFindFirst.mockResolvedValue({
        id: 'org-1',
        plan: 'pro',
        tokensMonthly: 50000,
      });
      mockOrgUpdate.mockResolvedValue({});

      const response = await POST(createRequest('valid_body'));

      expect(response.status).toBe(200);
      expect(mockOrgUpdate).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          tokensRemaining: 50000,
        }),
      });
    });
  });

  describe('customer.subscription.deleted', () => {
    it('downgrades org to free plan', async () => {
      mockConstructEvent.mockReturnValue(subscriptionDeletedEvent);
      mockOrgFindFirst.mockResolvedValue({ id: 'org-1' });
      mockOrgUpdate.mockResolvedValue({});

      const response = await POST(createRequest('valid_body'));

      expect(response.status).toBe(200);
      expect(mockOrgUpdate).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: expect.objectContaining({
          plan: 'free',
          tokensRemaining: 1000,
          tokensMonthly: 1000,
        }),
      });
    });
  });

  describe('Event Storage', () => {
    it('stores event for idempotency', async () => {
      mockConstructEvent.mockReturnValue(checkoutCompletedEvent);
      mockSubscriptionsRetrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
      });
      mockOrgUpdate.mockResolvedValue({});

      await POST(createRequest('valid_body'));

      expect(mockEventUpsert).toHaveBeenCalledWith({
        where: { id: 'evt_checkout_completed' },
        create: expect.objectContaining({
          id: 'evt_checkout_completed',
          type: 'checkout.session.completed',
        }),
        update: {},
      });
    });

    it('marks event as processed after handling', async () => {
      mockConstructEvent.mockReturnValue(checkoutCompletedEvent);
      mockSubscriptionsRetrieve.mockResolvedValue({
        items: { data: [{ price: { id: 'price_pro_monthly' } }] },
      });
      mockOrgUpdate.mockResolvedValue({});

      await POST(createRequest('valid_body'));

      expect(mockEventUpdate).toHaveBeenCalledWith({
        where: { id: 'evt_checkout_completed' },
        data: { processed: true, processedAt: expect.any(Date) },
      });
    });
  });
});
