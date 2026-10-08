import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { tooManyRequests } from "@/lib/api-helpers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe";

const schema = z.object({ confirmEmail: z.string().min(1).max(254) });

/** Permanently deletes the account and everything attached to it (history, keys, workflows, usage). */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const blocked = await consumeAll([{ scope: "password-change", id: userId, ...AUTH_RATE_LIMITS.passwordChange }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!parsed.success || parsed.data.confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json({ error: "Type your account email exactly to confirm." }, { status: 400 });
  }

  // Never delete an account that is still being billed: cancel the subscription first, and if that
  // can't be done, stop and say so rather than leaving a customer paying for an account that's gone.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.stripeSubscriptionId && subscription.status !== "canceled") {
    try {
      await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (err) {
      const alreadyGone = typeof err === "object" && err !== null && (err as { code?: string }).code === "resource_missing";
      if (!alreadyGone) {
        return NextResponse.json(
          { error: "We couldn't cancel your subscription automatically. Cancel it in Settings → Billing, then delete your account." },
          { status: 409 }
        );
      }
    }
  }

  // Cascades remove the user's sessions, linked accounts, history, API keys, workflows, usage and subscription row.
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true });
}
