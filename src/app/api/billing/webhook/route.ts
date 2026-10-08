import { type SubscriptionTier } from "@prisma/client";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// Maps a Stripe Price ID back to our tier enum. Checked at request time
// (not module load) so a missing env var doesn't crash the whole route.
function tierForPriceId(priceId: string | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "STARTER";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "PRO";
  return null;
}

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const priceId = sub.items.data[0]?.price?.id;
  const tier = tierForPriceId(priceId);

  const currentPeriodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  if (userId) {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: tier ?? "FREE",
        stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripeSubscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd,
      },
      update: {
        tier: tier ?? "FREE",
        stripeSubscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd,
      },
    });
    return;
  }

  // Fallback: metadata can be missing on renewal events - match by customer instead.
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await prisma.subscription.updateMany({
    where: { stripeCustomerId: customerId },
    data: { tier: tier ?? "FREE", stripeSubscriptionId: sub.id, status: sub.status, currentPeriodEnd },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { tier: "FREE", status: "canceled" },
      });
      break;
    }

    default:
      // Ignore anything we don't specifically handle.
      break;
  }

  return NextResponse.json({ received: true });
}
