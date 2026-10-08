import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordChangedEmail } from "@/lib/account-emails";
import { runAfterResponse } from "@/lib/after-response";
import { tooManyRequests } from "@/lib/api-helpers";
import { authOptions } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { validatePassword } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeAll } from "@/lib/rate-limit";

const schema = z.object({ currentPassword: z.string().min(1).max(1000), newPassword: z.string().max(1000) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const blocked = await consumeAll([{ scope: "password-change", id: userId, ...AUTH_RATE_LIMITS.passwordChange }]);
  if (blocked) return tooManyRequests(blocked.retryAfterSeconds);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your current and new password." }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: 'This account signs in with Google or GitHub and has no password. Use "Forgot password" on the sign-in page to create one.' },
      { status: 400 }
    );
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "Choose a password different from your current one." }, { status: 400 });
  }
  const policyError = validatePassword(newPassword, { email: user.email, name: user.name });
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    // Every session (this one included) is invalidated; the page signs the user straight back in.
    data: { passwordHash: await hashPassword(newPassword), sessionsValidAfter: new Date() },
  });

  if (user.email) {
    await runAfterResponse(async () => {
      await sendPasswordChangedEmail({ name: user.name, email: user.email as string });
    });
  }
  return NextResponse.json({ ok: true });
}
