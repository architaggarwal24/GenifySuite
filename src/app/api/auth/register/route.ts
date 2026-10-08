import { NextResponse } from "next/server";
import { z } from "zod";
import { sendVerificationEmail } from "@/lib/account-emails";
import { isUniqueViolation, tooManyRequests } from "@/lib/api-helpers";
import { getAppUrl } from "@/lib/app-url";
import { ipFromRequest } from "@/lib/client-ip";
import { hashPassword } from "@/lib/passwords";
import { validatePassword } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().max(254).email("Enter a valid email address").toLowerCase(),
  // The real rules (length, 72-byte limit, common passwords) live in validatePassword.
  password: z.string().max(1000),
});

export async function POST(request: Request) {
  const blocked = await consumeAll([{ scope: "register-ip", id: ipFromRequest(request), ...AUTH_RATE_LIMITS.registerIp }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const policyError = validatePassword(password, { email, name });
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  let user: { id: string; name: string | null; email: string | null };
  try {
    user = await prisma.user.create({ data: { name, email, passwordHash }, select: { id: true, name: true, email: true } });
  } catch (err) {
    // Two sign-ups for the same email raced past the check above; the database's unique index decides.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    throw err;
  }

  // The account exists either way; a failed email just means they can use "resend" from the banner.
  const verificationEmailSent = await sendVerificationEmail({ name, email }, getAppUrl(request));

  return NextResponse.json({ ok: true, verificationEmailSent });
}
