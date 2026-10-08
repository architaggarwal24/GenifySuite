import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/account-emails";
import { tooManyRequests } from "@/lib/api-helpers";
import { getAppUrl } from "@/lib/app-url";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, emailVerified: true } });
  if (!user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const blocked = await consumeAll([{ scope: "resend-verification", id: userId, ...AUTH_RATE_LIMITS.resendVerification }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  // They're signed in, so there's no account-existence secret to protect: report a failed send honestly.
  const sent = await sendVerificationEmail({ name: user.name, email: user.email }, getAppUrl(request));
  if (!sent) {
    return NextResponse.json({ error: "We couldn't send the email right now. Try again in a few minutes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
