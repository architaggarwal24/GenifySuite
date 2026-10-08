import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordChangedEmail } from "@/lib/account-emails";
import { runAfterResponse } from "@/lib/after-response";
import { tooManyRequests } from "@/lib/api-helpers";
import { ipFromRequest } from "@/lib/client-ip";
import { hashPassword } from "@/lib/passwords";
import { validatePassword } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";
import { consumeEmailToken } from "@/lib/tokens";

const schema = z.object({ token: z.string().min(1).max(200), password: z.string().max(1000) });

const INVALID_LINK = "This reset link is invalid or has expired. Request a new one.";

export async function POST(request: Request) {
  const blocked = await consumeAll([{ scope: "reset-ip", id: ipFromRequest(request), ...AUTH_RATE_LIMITS.resetIp }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
  const { token, password } = parsed.data;

  // Check the password BEFORE redeeming the token: a too-weak password must not burn a single-use link.
  const policyError = validatePassword(password);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const email = await consumeEmailToken("reset", token);
  if (!email) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, emailVerified: true } });
  if (!user) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      // Receiving the link proves they control the mailbox.
      emailVerified: user.emailVerified ?? now,
      // Everyone currently signed in (including whoever knew the old password) is signed out.
      sessionsValidAfter: now,
    },
  });

  await runAfterResponse(async () => {
    await sendPasswordChangedEmail({ name: user.name, email });
  });

  return NextResponse.json({ ok: true });
}
