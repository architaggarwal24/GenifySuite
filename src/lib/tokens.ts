import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export type TokenPurpose = "verify" | "reset";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

// Both purposes share the NextAuth VerificationToken table; the purpose is a prefix on `identifier`,
// so a password-reset token can never be redeemed as an email-verification token or vice versa.
const identifierFor = (purpose: TokenPurpose, email: string) => `${purpose}:${email.toLowerCase().trim()}`;

/** Only this hash is stored, so a database leak doesn't hand out working reset links. */
export const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw).digest("hex");

export const generateRawToken = (): string => crypto.randomBytes(32).toString("base64url");

/** Creates a fresh single-use token, replacing any earlier one for the same purpose and email. Returns the raw token (for the email link). */
export async function createEmailToken(purpose: TokenPurpose, email: string, now: number = Date.now()): Promise<string> {
  const identifier = identifierFor(purpose, email);
  const raw = generateRawToken();
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashToken(raw), expires: new Date(now + TOKEN_TTL_MS[purpose]) },
  });
  return raw;
}

/**
 * Redeems a token. Returns the email it was issued for, or null if it is unknown, the wrong purpose,
 * expired, or already used. A valid token is consumed (single-use) even if it turns out to be expired.
 */
export async function consumeEmailToken(purpose: TokenPurpose, rawToken: string, now: number = Date.now()): Promise<string | null> {
  if (!rawToken || rawToken.length > 200) return null;
  const hashed = hashToken(rawToken);

  const row = await prisma.verificationToken.findUnique({ where: { token: hashed } });
  if (!row || !row.identifier.startsWith(`${purpose}:`)) return null;

  // Delete-then-check makes redemption atomic: of two simultaneous requests, only one sees count === 1.
  const { count } = await prisma.verificationToken.deleteMany({ where: { token: hashed } });
  if (count !== 1) return null;
  if (row.expires.getTime() < now) return null;

  return row.identifier.slice(purpose.length + 1);
}
