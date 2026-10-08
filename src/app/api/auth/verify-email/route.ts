import { NextResponse } from "next/server";
import { z } from "zod";
import { tooManyRequests } from "@/lib/api-helpers";
import { ipFromRequest } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";
import { consumeEmailToken } from "@/lib/tokens";

const schema = z.object({ token: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const blocked = await consumeAll([{ scope: "verify-ip", id: ipFromRequest(request), ...AUTH_RATE_LIMITS.verifyIp }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const email = parsed.success ? await consumeEmailToken("verify", parsed.data.token) : null;
  if (!email) {
    return NextResponse.json({ error: "This confirmation link is invalid or has expired." }, { status: 400 });
  }

  // updateMany: harmless if the account was deleted in the meantime, and never overwrites an earlier timestamp.
  await prisma.user.updateMany({ where: { email, emailVerified: null }, data: { emailVerified: new Date() } });
  return NextResponse.json({ ok: true });
}
