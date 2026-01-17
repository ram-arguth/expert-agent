/**
 * Stripe Webhook Handler
 *
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription management.
 *
 * Events handled:
 * - checkout.session.completed: Link Stripe Customer to org. Set plan and tokens.
 * - invoice.payment_succeeded: Reset token quota on renewal.
 * - invoice.payment_failed: Notify admins.
 * - customer.subscription.deleted: Downgrade to free.
 *
 * Note: Billing is org-level only in this platform. Individual users
 * don't have direct billing - they join orgs that have subscriptions.
 *
 * @see docs/DESIGN.md - Billing Integration section
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";

// Lazy initialization of Stripe client to prevent build-time errors
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

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Plan to tokens mapping
const PLAN_TOKEN_LIMITS: Record<string, number> = {
  free: 1000,
  pro: 50000,
  enterprise: 500000,
};

// Price ID to plan mapping (configure in environment)
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly"]: "pro",
  [process.env.STRIPE_PRICE_PRO_YEARLY || "price_pro_yearly"]: "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "price_enterprise_monthly"]:
    "enterprise",
  [process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || "price_enterprise_yearly"]:
    "enterprise",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 },
      );
    }

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        body,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Log event for idempotency tracking
    const existingEvent = await prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });

    if (existingEvent?.processed) {
      // Already processed this event
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Store event
    await prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        type: event.type,
        data: event.data as object,
        processed: false,
      },
      update: {},
    });

    // Handle the event
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await prisma.stripeEvent.update({
        where: { id: event.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (error) {
      // Log error but don't fail the webhook
      console.error(`Error processing event ${event.id}:`, error);
      await prisma.stripeEvent.update({
        where: { id: event.id },
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { customer, subscription, metadata, mode } = session;
  const orgId = metadata?.orgId;

  if (!customer || typeof customer !== "string") {
    console.error("Missing customer in checkout session");
    return;
  }

  if (!orgId) {
    console.error("Missing orgId in checkout session metadata");
    return;
  }

  // Handle token top-up (one-time payment)
  if (mode === "payment" && metadata?.type === "token_topup") {
    const tokens = parseInt(metadata.tokens || "0", 10);

    if (tokens > 0) {
      // Add tokens to existing balance (don't reset quota date)
      await prisma.org.update({
        where: { id: orgId },
        data: {
          stripeCustomerId: customer,
          tokensRemaining: { increment: tokens },
        },
      });
      console.log(`Added ${tokens} tokens to org ${orgId} via top-up`);
    }
    return;
  }

  // Handle subscription checkout
  // Get subscription details to determine plan
  let plan = "pro"; // Default
  if (subscription && typeof subscription === "string") {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscription);
      const priceId = sub.items.data[0]?.price.id;
      if (priceId && PRICE_TO_PLAN[priceId]) {
        plan = PRICE_TO_PLAN[priceId];
      }
    } catch (err) {
      console.error("Error fetching subscription:", err);
    }
  }

  const tokenLimit = PLAN_TOKEN_LIMITS[plan] || PLAN_TOKEN_LIMITS.pro;

  // Update organization with Stripe info and new plan
  await prisma.org.update({
    where: { id: orgId },
    data: {
      stripeCustomerId: customer,
      plan: plan,
      tokensRemaining: tokenLimit,
      tokensMonthly: tokenLimit,
      quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });

  console.log(`Updated org ${orgId} to plan ${plan} with ${tokenLimit} tokens`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const { customer, subscription } = invoice;

  if (!customer || typeof customer !== "string") return;
  if (!subscription) return; // Not a subscription invoice

  // Find org by customer ID and reset tokens
  const org = await prisma.org.findFirst({
    where: { stripeCustomerId: customer },
    select: { id: true, plan: true, tokensMonthly: true },
  });

  if (org) {
    const tokenLimit =
      org.tokensMonthly || PLAN_TOKEN_LIMITS[org.plan || "free"];
    await prisma.org.update({
      where: { id: org.id },
      data: {
        tokensRemaining: tokenLimit,
        quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`Reset tokens for org ${org.id} to ${tokenLimit}`);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const { customer } = invoice;

  if (!customer || typeof customer !== "string") return;

  // Find org and log payment failure
  // In a full implementation, you'd send email notifications to admins
  const org = await prisma.org.findFirst({
    where: { stripeCustomerId: customer },
    select: { id: true, name: true },
  });

  if (org) {
    console.log(`Payment failed for org ${org.id} (${org.name})`);
    // TODO: Send notification to org admins
    // TODO: Consider grace period before downgrade
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { customer } = subscription;

  if (!customer || typeof customer !== "string") return;

  // Find org and downgrade to free plan
  const org = await prisma.org.findFirst({
    where: { stripeCustomerId: customer },
    select: { id: true },
  });

  if (org) {
    await prisma.org.update({
      where: { id: org.id },
      data: {
        plan: "free",
        tokensRemaining: PLAN_TOKEN_LIMITS.free,
        tokensMonthly: PLAN_TOKEN_LIMITS.free,
      },
    });
    console.log(`Downgraded org ${org.id} to free plan`);
  }
}
