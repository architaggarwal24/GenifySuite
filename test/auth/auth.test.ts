import bcrypt from "bcryptjs";
import NextAuth, { getServerSession } from "next-auth";
import { decode, encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_RATE_LIMITED, authOptions, authorizeCredentials, buildSession } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import type { FakePrisma } from "../fake-prisma";
import { installNextHeadersFake, setRequestContext } from "../helpers/next-headers";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
const PASSWORD = "correct horse battery";
const IP = { "x-forwarded-for": "203.0.113.1" };

async function makeUser(overrides: Record<string, unknown> = {}) {
  return db.user.create({ data: { email: "alice@example.com", name: "Alice", passwordHash: await hashPassword(PASSWORD), emailVerified: new Date(), ...overrides } });
}
const login = (email: string, password: string, headers: Record<string, unknown> = IP) => authorizeCredentials({ email, password }, headers);

beforeEach(() => db.__reset());

describe("authorizeCredentials", () => {
  it("signs in with the right password, ignoring email case and padding", async () => {
    const user = await makeUser();
    expect(await login("  ALICE@Example.com ", PASSWORD)).toEqual({ id: user.id, name: "Alice", email: "alice@example.com", image: null });
  });

  it("refuses a wrong password, an unknown email, and empty or absurd input", async () => {
    await makeUser();
    expect(await login("alice@example.com", "wrong")).toBeNull();
    expect(await login("nobody@example.com", PASSWORD)).toBeNull();
    expect(await login("", PASSWORD)).toBeNull();
    expect(await login("alice@example.com", "")).toBeNull();
    expect(await login("a".repeat(300) + "@example.com", PASSWORD)).toBeNull();
    expect(await authorizeCredentials(undefined, IP)).toBeNull();
  });

  it("refuses an OAuth-only account (no password) without crashing", async () => {
    await makeUser({ passwordHash: null });
    expect(await login("alice@example.com", PASSWORD)).toBeNull();
  });

  it("still does a full bcrypt comparison for an unknown email, so timing doesn't reveal who has an account", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    await login("nobody@example.com", "whatever password");
    expect(compare).toHaveBeenCalledTimes(1);
  });

  describe("throttling failed attempts", () => {
    it("locks an account+address pair after 8 failures - even the correct password is refused", async () => {
      await makeUser();
      for (let i = 0; i < 8; i++) expect(await login("alice@example.com", `wrong${i}`)).toBeNull();
      await expect(login("alice@example.com", PASSWORD)).rejects.toThrow(LOGIN_RATE_LIMITED);
    });

    it("doesn't let a stranger hammering your account lock you out from your own address", async () => {
      await makeUser();
      for (let i = 0; i < 8; i++) await login("alice@example.com", `wrong${i}`, { "x-forwarded-for": "198.51.100.66" });
      await expect(login("alice@example.com", PASSWORD, { "x-forwarded-for": "198.51.100.66" })).rejects.toThrow(LOGIN_RATE_LIMITED);
      expect(await login("alice@example.com", PASSWORD, { "x-forwarded-for": "203.0.113.50" })).toMatchObject({ email: "alice@example.com" });
    });

    it("counts only FAILURES - successful sign-ins never use up the allowance", async () => {
      await makeUser();
      for (let i = 0; i < 7; i++) await login("alice@example.com", `wrong${i}`);
      for (let i = 0; i < 30; i++) expect(await login("alice@example.com", PASSWORD)).toBeTruthy();
      expect(await login("alice@example.com", "wrong-again")).toBeNull(); // 8th failure
      await expect(login("alice@example.com", PASSWORD)).rejects.toThrow(LOGIN_RATE_LIMITED);
    });

    it("blocks an address that tries many different accounts (credential stuffing)", async () => {
      await makeUser();
      for (let i = 0; i < 40; i++) await login(`victim${i}@example.com`, "guess");
      await expect(login("alice@example.com", PASSWORD)).rejects.toThrow(LOGIN_RATE_LIMITED);
      expect(await login("alice@example.com", PASSWORD, { "x-forwarded-for": "203.0.113.99" })).toBeTruthy();
    });

    it("blocks a distributed attack on one account that rotates addresses", async () => {
      await makeUser();
      for (let i = 0; i < 40; i++) await login("alice@example.com", "guess", { "x-forwarded-for": `10.1.${i}.1` });
      await expect(login("alice@example.com", PASSWORD, { "x-forwarded-for": "10.2.0.1" })).rejects.toThrow(LOGIN_RATE_LIMITED);
    });

    it("applies only the per-account limit when there's no detectable address", async () => {
      await makeUser();
      for (let i = 0; i < 9; i++) await login("alice@example.com", `wrong${i}`, {});
      expect(await login("alice@example.com", PASSWORD, {})).toBeTruthy(); // 9 < 40: not locked
    });

    it("uses the first address of a forwarded chain, including array-valued headers", async () => {
      await makeUser();
      for (let i = 0; i < 8; i++) await login("alice@example.com", "bad", { "x-forwarded-for": ["198.51.100.7, 10.0.0.1"] });
      await expect(login("alice@example.com", PASSWORD, { "x-forwarded-for": "198.51.100.7" })).rejects.toThrow(LOGIN_RATE_LIMITED);
    });

    it("fails open - sign-in keeps working if the limiter's table is unavailable", async () => {
      await makeUser();
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(db.rateLimit, "findUnique").mockRejectedValue(new Error("no such table"));
      vi.spyOn(db.rateLimit, "upsert").mockRejectedValue(new Error("no such table"));
      expect(await login("alice@example.com", PASSWORD)).toBeTruthy();
      expect(await login("alice@example.com", "wrong")).toBeNull();
    });
  });
});

describe("buildSession", () => {
  const base = { user: { name: "Alice", email: "alice@example.com" }, expires: "2099-01-01" } as never;

  it("adds the user id and the CURRENT verification state", async () => {
    const user = await makeUser({ emailVerified: null });
    expect((await buildSession({ session: structuredClone(base), token: { uid: user.id } })).user).toMatchObject({ id: user.id, emailVerified: false });
    db.user.__rows[0].emailVerified = new Date();
    expect((await buildSession({ session: structuredClone(base), token: { uid: user.id } })).user.emailVerified).toBe(true);
  });

  it("returns an empty (signed-out) session for a token with no user id, or for a deleted account", async () => {
    expect(await buildSession({ session: structuredClone(base), token: {} })).toEqual({});
    expect(await buildSession({ session: structuredClone(base), token: { uid: "ghost" } })).toEqual({});
  });

  it("signs out sessions older than the cut-off, but not newer ones, not even one made in the same second", async () => {
    const user = await makeUser({ sessionsValidAfter: new Date("2026-09-30T12:00:00.900Z") });
    const iat = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
    expect(await buildSession({ session: structuredClone(base), token: { uid: user.id, iat: iat("2026-09-30T11:59:59Z") } })).toEqual({});
    expect((await buildSession({ session: structuredClone(base), token: { uid: user.id, iat: iat("2026-09-30T12:00:00Z") } })).user?.id).toBe(user.id);
    expect((await buildSession({ session: structuredClone(base), token: { uid: user.id, iat: iat("2026-09-30T12:05:00Z") } })).user?.id).toBe(user.id);
  });
});

// ---- the REAL NextAuth library, driven with real JWT cookies --------------------------------------------
installNextHeadersFake();
const handler = NextAuth(authOptions) as unknown as (req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;
const SECRET = "integration-test-secret";
const SESSION_COOKIE = "next-auth.session-token";

const mintSession = (uid: string) => encode({ token: { uid, sub: uid, name: "Alice", email: "alice@example.com" }, secret: SECRET });
const callAuth = (path: string[], init: { method?: string; body?: string; headers?: Record<string, string> } = {}) =>
  handler(new NextRequest(`http://localhost:3000/api/auth/${path.join("/")}`, init), { params: Promise.resolve({ nextauth: path }) });

describe("through the real NextAuth", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET);
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
    setRequestContext();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const readSession = async (jwt?: string) => {
    setRequestContext({ cookies: jwt ? { [SESSION_COOKIE]: jwt } : {} });
    return (await callAuth(["session"])).json();
  };

  it("serves a signed-in session with the user's id and verification state", async () => {
    const user = await makeUser();
    expect(await readSession(await mintSession(user.id))).toMatchObject({ user: { id: user.id, email: "alice@example.com", emailVerified: true } });
  });

  it("serves an empty session (what clients read as 'signed out') with no cookie, a forged cookie, or a deleted account", async () => {
    const user = await makeUser();
    expect(await readSession()).toEqual({});
    expect(await readSession("not-a-valid-jwt")).toEqual({});
    const jwt = await mintSession(user.id);
    db.user.__rows.length = 0;
    expect(await readSession(jwt)).toEqual({});
  });

  it("a password change signs out older sessions, and a fresh sign-in afterwards works", async () => {
    const user = await makeUser();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    const oldJwt = await mintSession(user.id);
    expect(await readSession(oldJwt)).toMatchObject({ user: { id: user.id } });

    vi.setSystemTime(new Date("2026-09-30T12:10:00Z"));
    db.user.__rows[0].sessionsValidAfter = new Date(); // what changing the password / "sign out everywhere" does
    expect(await readSession(oldJwt)).toEqual({});

    vi.setSystemTime(new Date("2026-09-30T12:10:05Z"));
    expect(await readSession(await mintSession(user.id))).toMatchObject({ user: { id: user.id } });
  });

  it("getServerSession (what every page and API route calls) returns null for a signed-out or invalidated session", async () => {
    const user = await makeUser();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    const jwt = await mintSession(user.id);

    setRequestContext({ cookies: { [SESSION_COOKIE]: jwt } });
    expect((await getServerSession(authOptions))?.user).toMatchObject({ id: user.id, emailVerified: true });

    vi.setSystemTime(new Date("2026-09-30T12:30:00Z"));
    db.user.__rows[0].sessionsValidAfter = new Date();
    expect(await getServerSession(authOptions)).toBeNull();

    setRequestContext();
    expect(await getServerSession(authOptions)).toBeNull();
  });

  describe("signing in with email and password", () => {
    async function signIn(email: string, password: string, headers: Record<string, string> = IP) {
      setRequestContext({ headers });
      const csrfRes = await callAuth(["csrf"]);
      const { csrfToken } = await csrfRes.json();
      const csrfCookie = csrfRes.headers.getSetCookie().find((c) => c.startsWith("next-auth.csrf-token="))!;
      const csrfValue = decodeURIComponent(csrfCookie.split(";")[0].split("=").slice(1).join("="));

      setRequestContext({ headers, cookies: { "next-auth.csrf-token": csrfValue } });
      const res = await callAuth(["callback", "credentials"], {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, email, password, json: "true", redirect: "false" }).toString(),
      });
      const { url } = await res.json();
      return { url: String(url), cookies: res.headers.getSetCookie() };
    }

    it("issues a session cookie that identifies the user", async () => {
      const user = await makeUser();
      const { url, cookies } = await signIn("alice@example.com", PASSWORD);
      expect(url).not.toContain("error=");

      const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
      expect(cookie).toBeTruthy();
      const token = await decode({ token: cookie!.split(";")[0].split("=").slice(1).join("="), secret: SECRET });
      expect(token?.uid).toBe(user.id);
    });

    it("reports a wrong password as CredentialsSignin and sets no session", async () => {
      await makeUser();
      const { url, cookies } = await signIn("alice@example.com", "wrong password");
      expect(url).toContain("error=CredentialsSignin");
      expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
    });

    it("reports a throttled attempt as RATE_LIMITED - the exact code the login form shows its 'too many attempts' message for", async () => {
      await makeUser();
      for (let i = 0; i < 8; i++) await signIn("alice@example.com", `wrong${i}`);
      const { url, cookies } = await signIn("alice@example.com", PASSWORD);
      expect(url).toContain(`error=${LOGIN_RATE_LIMITED}`);
      expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
    });
  });
});
