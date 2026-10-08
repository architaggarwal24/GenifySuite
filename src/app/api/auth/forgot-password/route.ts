import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/account-emails";
import { runAfterResponse } from "@/lib/after-response";
import { tooManyRequests } from "@/lib/api-helpers";
import { getAppUrl } from "@/lib/app-url";
import { ipFromRequest } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().max(254).email("Enter a valid email address").toLowerCase() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email } = parsed.data;

  // Every request counts (each one can cost us an email), whether or not the account exists.
  const blocked = await consumeAll([
    { scope: "forgot-ip", id: ipFromRequest(request), ...AUTH_RATE_LIMITS.forgotIp },
    { scope: "forgot-email", id: email, ...AUTH_RATE_LIMITS.forgotEmail },
  ]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const user = await prisma.user.findUnique({ where: { email }, select: { name: true, email: true } });
  const baseUrl = getAppUrl(request);

  // Same response, in the same time, whether or not this email has an account: the token + email work
  // happens after the response is sent, and the answer never says which case it was.
  if (user?.email) {
    await runAfterResponse(async () => {
      await sendPasswordResetEmail({ name: user.name, email: user.email as string }, baseUrl);
    });
  }

  return NextResponse.json({ ok: true });
}
