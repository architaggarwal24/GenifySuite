import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, type Session } from "next-auth";
import { type JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

import { getClientIp } from "@/lib/client-ip";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMITS, consumeRateLimit, peekRateLimit } from "@/lib/rate-limit";
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
 * Email + password sign-in. Failed attempts are throttled three ways (this account from this address, this
 * address across accounts, this account from anywhere); only FAILURES count, so successful logins never use
 * up the allowance. A missing account does the same bcrypt work as a real one, so timing doesn't reveal
 * which emails are registered.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", string>> | undefined,
  headers?: HeaderBag
) {
  const email = credentials?.email?.toLowerCase().trim();
  const password = credentials?.password;
  if (!email || !password || email.length > 254) return null;

  const ip = getClientIp((name) => headerValue(headers, name));
  const buckets = [
    { scope: "login-email", id: email, ...AUTH_RATE_LIMITS.loginFailedEmail },
    ...(ip
      ? [
          { scope: "login-ip", id: ip, ...AUTH_RATE_LIMITS.loginFailedIp },
          { scope: "login-pair", id: `${email}|${ip}`, ...AUTH_RATE_LIMITS.loginFailedPair },
        ]
      : []),
  ];

  const checks = await Promise.all(buckets.map((b) => peekRateLimit(b.scope, b.id, b.limit, b.windowSeconds)));
  if (checks.some((c) => !c.allowed)) throw new Error(LOGIN_RATE_LIMITED);

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid) {
    await Promise.all(buckets.map((b) => consumeRateLimit(b.scope, b.id, b.limit, b.windowSeconds)));
    return null;
  }

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
