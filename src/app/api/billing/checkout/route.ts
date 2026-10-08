import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getPlan } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const requestSchema = z.object({ tier: z.enum(["STARTER", "PRO"]) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!session.user.emailVerified) {
    return NextResponse.json({ error: "Verify your email address before subscribing." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const plan = getPlan(parsed.data.tier);
  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: `${plan.name} isn't configured yet — this deployment is missing STRIPE_PRICE_${plan.tier}.` },
      { status: 503 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Billing isn't configured on this deployment yet." }, { status: 503 });
  }

  const existing = await prisma.subscription.findUnique({ where: { userId: session.user.id } });

  let customerId = existing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const origin = new URL(request.url).origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: session.user.id,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/settings/billing?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
    metadata: { userId: session.user.id, tier: plan.tier },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
