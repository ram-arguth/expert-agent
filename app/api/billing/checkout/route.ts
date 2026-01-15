/**
 * Stripe Checkout API
 *
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for organization subscription.
 *
 * Request body:
 * - priceId: Stripe Price ID
 * - orgId: Organization ID (required - billing is org-level only)
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL for checkout
 *
 * Note: Individual user billing is not supported. Users must be part of
 * an organization to have a paid subscription.
 *
 * @see docs/DESIGN.md - Billing Integration section
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Lazy initialization of Stripe client to prevent build-time errors
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return stripeInstance;
}

// Stripe Price IDs (from environment or constants)
const VALID_PRICE_IDS = [
  process.env.STRIPE_PRICE_PRO_MONTHLY,
  process.env.STRIPE_PRICE_PRO_YEARLY,
  process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  process.env.STRIPE_PRICE_TOKEN_TOPUP,
].filter(Boolean);

interface CheckoutRequestBody {
  priceId: string;
  orgId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutRequestBody;
    const { priceId, orgId } = body;

    // Validate priceId
    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 });
    }

    // orgId is required - individual billing is not supported
    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required. Individual billing is not supported.' },
        { status: 400 }
      );
    }

    // In production, validate priceId against known prices
    if (process.env.NODE_ENV === 'production' && VALID_PRICE_IDS.length > 0) {
      if (!VALID_PRICE_IDS.includes(priceId)) {
        return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
      }
    }

    // Verify membership and permissions
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        orgId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not authorized to manage billing for this organization' },
        { status: 403 }
      );
    }

    // Get or create Stripe customer for org
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, name: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    let stripeCustomerId: string;

    if (org.stripeCustomerId) {
      stripeCustomerId = org.stripeCustomerId;
    } else {
      // Create new Stripe customer for org
      const customer = await getStripe().customers.create({
        email: session.user.email || undefined,
        name: org.name || `Organization ${orgId}`,
        metadata: {
          orgId,
          createdBy: session.user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Update org with Stripe customer ID
      await prisma.org.update({
        where: { id: orgId },
        data: { stripeCustomerId: customer.id },
      });
    }

    // Build success and cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing/cancel`;

    // Create Stripe Checkout Session
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription', // Use 'payment' for one-time purchases
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: session.user.id,
        orgId,
      },
      subscription_data: {
        metadata: {
          userId: session.user.id,
          orgId,
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);

    // Handle Stripe-specific errors (check by error type/properties)
    if (
      error instanceof Error &&
      'type' in error &&
      typeof (error as { type: unknown }).type === 'string' &&
      (error as { type: string }).type.startsWith('Stripe')
    ) {
      const stripeError = error as Error & { statusCode?: number };
      return NextResponse.json(
        { error: stripeError.message },
        { status: stripeError.statusCode || 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
