/**
 * Stripe Customer Portal API
 *
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for subscription management.
 *
 * Request body:
 * - orgId: Organization ID (required)
 *
 * Returns:
 * - url: Stripe Customer Portal URL
 *
 * @see docs/DESIGN.md - Billing Integration section
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
});

interface PortalRequestBody {
  orgId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as PortalRequestBody;
    const { orgId } = body;

    // orgId is required
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }

    // Verify membership and permissions (Admin or Owner can access billing)
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        orgId,
        role: { in: ['ADMIN', 'OWNER', 'BILLING_MANAGER'] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not authorized to manage billing for this organization' },
        { status: 403 }
      );
    }

    // Get org with Stripe customer ID
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, name: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Organization does not have an active subscription' },
        { status: 400 }
      );
    }

    // Build return URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/settings/billing`;

    // Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);

    // Handle Stripe-specific errors
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
