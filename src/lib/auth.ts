import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, type Session } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { getClientIp } from "@/lib/client-ip";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeRateLimit, peekRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { assertProductionSecrets } from "@/lib/secrets-check";
import { isSessionStale } from "@/lib/session-validity";

/** The `error` the sign-in form receives when too many recent attempts have failed. */
export const LOGIN_RATE_LIMITED = "RATE_LIMITED";

type HeaderBag = Record<string, unknown> | undefined;

function headerValue(headers: HeaderBag, name: string): string | undefined {
  const value = headers?.[name];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * Email + password sign-in. Attempts are throttled three ways (this account from this address, this address
 * across accounts, this account from anywhere).
 *
 * Each attempt is COUNTED FIRST, atomically, and only then checked against the password. (Checking the counter
 * and counting later would let a burst of parallel guesses all see "no failures yet" and all be tried.) A
 * successful sign-in gives its count back, so only failures use up the allowance.
 *
 * The per-account cap is what stops an attacker rotating addresses - but it also means someone can fill it to
 * block the real owner. So an address that has signed into this account before is exempt from that one cap:
 * strangers can't lock you out of the device you normally use, and a stranger can't earn the exemption
 * without already knowing the password. (A new device of a targeted account can still be held back; password
 * reset and OAuth sign-in are unaffected.)
 *
 * A missing account does the same bcrypt work as a real one, so timing doesn't reveal which emails are registered.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", string>> | undefined,
  headers?: HeaderBag
) {
  assertProductionSecrets();

  const email = credentials?.email?.toLowerCase().trim();
  const password = credentials?.password;
  if (!email || !password || email.length > 254) return null;

  const ip = getClientIp((name) => headerValue(headers, name));
  const device = ip ? { scope: "login-known", id: `${email}|${ip}`, ...AUTH_RATE_LIMITS.loginKnownDevice } : null;
  const knownDevice = device ? !(await peekRateLimit(device.scope, device.id, device.limit, device.windowSeconds)).allowed : false;

  const buckets = [
    ...(knownDevice ? [] : [{ scope: "login-email", id: email, ...AUTH_RATE_LIMITS.loginFailedEmail }]),
    ...(ip
      ? [
          { scope: "login-ip", id: ip, ...AUTH_RATE_LIMITS.loginFailedIp },
          { scope: "login-pair", id: `${email}|${ip}`, ...AUTH_RATE_LIMITS.loginFailedPair },
        ]
      : []),
  ];

  // Count this attempt first; the atomic increment is what makes the limit hold under parallel requests.
  const counted = await Promise.all(buckets.map((b) => consumeRateLimit(b.scope, b.id, b.limit, b.windowSeconds)));
  if (counted.some((c) => !c.allowed)) throw new Error(LOGIN_RATE_LIMITED);

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) return null; // stays counted

  // Success: forgive this attempt, and remember the address as a known device for this account.
  await Promise.all(buckets.map((b) => refundRateLimit(b.scope, b.id, b.windowSeconds)));
  if (device && !knownDevice) await consumeRateLimit(device.scope, device.id, device.limit, device.windowSeconds);

  return { id: user.id, name: user.name, email: user.email, image: user.image };
}

/**
 * Runs on every session read. Two jobs a stateless JWT can't do on its own:
 *  - sign people out when their account was deleted, or after a password change / "sign out everywhere"
 *    (sessions older than User.sessionsValidAfter), by returning an EMPTY session, which NextAuth and
 *    getServerSession both treat as "not signed in";
 *  - expose whether the email is verified, always freshly read rather than frozen into the token.
 */
export async function buildSession({ session, token }: { session: Session; token: JWT }): Promise<Session> {
  assertProductionSecrets();
  const uid = token.uid;
  if (!uid) return {} as Session;

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { sessionsValidAfter: true, emailVerified: true },
  });
  if (!user || isSessionStale(typeof token.iat === "number" ? token.iat : undefined, user.sessionsValidAfter)) return {} as Session;

  session.user = { ...session.user, id: uid, emailVerified: Boolean(user.emailVerified) };
  return session;
}

// OAuth providers are only registered when their credentials are actually
// set, so the app still runs locally with just email/password configured.
const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: (credentials, req) => authorizeCredentials(credentials, req?.headers),
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(GitHubProvider({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }));
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/dashboard",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session: buildSession,
  },
  events: {
    // Only OAuth sign-ups go through the adapter's createUser (email/password sign-ups use our own
    // register route), and the provider has already verified the address.
    async createUser({ user }) {
      await prisma.user.updateMany({ where: { id: user.id, emailVerified: null }, data: { emailVerified: new Date() } });
    },
  },
};
