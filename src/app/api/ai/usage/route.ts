import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkUsage, SHARED_KEY_DAILY_LIMIT } from "@/lib/ai/usage";
import { prisma } from "@/lib/prisma";
import { effectiveTier } from "@/lib/billing-status";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const subscription = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  const tier = effectiveTier(subscription);

  const shared = await checkUsage(session.user.id, true, tier);
  const byok = await checkUsage(session.user.id, false, tier);

  return NextResponse.json({
    tier,
    shared,
    byok,
    sharedKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    tierLimits: SHARED_KEY_DAILY_LIMIT,
  });
}
