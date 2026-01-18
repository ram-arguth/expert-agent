/**
 * Token Top-Up API
 *
 * POST /api/billing/topup
 * Creates a Stripe Checkout Session for one-time token purchase.
 *
 * Request body:
 * - packId: Token pack identifier (e.g., '10k', '50k', '100k')
 * - orgId: Organization ID
 *
 * Returns:
 * - sessionId: Stripe Checkout Session ID
 * - url: Redirect URL for checkout
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.2
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Lazy initialization of Stripe client
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return stripeInstance;
}

// Token pack configurations - lazy loaded for testing
function getTokenPacks(): Record<
  string,
  { tokens: number; priceId: string | undefined }
> {
  return {
    "10k": { tokens: 10000, priceId: process.env.STRIPE_PRICE_TOPUP_10K },
    "50k": { tokens: 50000, priceId: process.env.STRIPE_PRICE_TOPUP_50K },
    "100k": { tokens: 100000, priceId: process.env.STRIPE_PRICE_TOPUP_100K },
  };
}

interface TopupRequestBody {
  packId: string;
  orgId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as TopupRequestBody;
    const { packId, orgId } = body;

    const TOKEN_PACKS = getTokenPacks();

    // Validate packId
    if (!packId || !TOKEN_PACKS[packId]) {
      return NextResponse.json(
        { error: "Invalid packId. Valid options: 10k, 50k, 100k" },
        { status: 400 },
      );
    }

    // orgId is required
    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const pack = TOKEN_PACKS[packId];

    // Verify priceId is configured
    if (!pack.priceId) {
      return NextResponse.json(
        { error: "Token pack not available" },
        { status: 400 },
      );
    }

    // Verify membership and permissions
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        orgId,
        role: { in: ["ADMIN", "OWNER"] },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized to manage billing for this organization" },
        { status: 403 },
      );
    }

    // Cedar authorization with User principal
    const { cedar, buildPrincipalFromSession } =
      await import("@/lib/authz/cedar");
    const principal = buildPrincipalFromSession(session, [
      { orgId, role: membership.role },
    ]);
    const decision = cedar.isAuthorized({
      principal,
      action: { type: "Action", id: "TopUp" },
      resource: { type: "Org", id: orgId },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get org with Stripe customer
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/billing/topup-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing/cancel`;

    // Create Stripe Checkout Session for one-time payment
    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment", // One-time payment, not subscription
      payment_method_types: ["card"],
      line_items: [
        {
          price: pack.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: session.user.id,
        orgId,
        type: "token_topup",
        packId,
        tokens: pack.tokens.toString(),
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      tokens: pack.tokens,
    });
  } catch (error) {
    console.error("Error creating top-up session:", error);

    if (
      error instanceof Error &&
      "type" in error &&
      typeof (error as { type: unknown }).type === "string" &&
      (error as { type: string }).type.startsWith("Stripe")
    ) {
      const stripeError = error as Error & { statusCode?: number };
      return NextResponse.json(
        { error: stripeError.message },
        { status: stripeError.statusCode || 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
