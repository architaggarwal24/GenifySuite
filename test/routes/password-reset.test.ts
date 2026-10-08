import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as forgotRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetRoute } from "@/app/api/auth/reset-password/route";
import { sendEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { createEmailToken } from "@/lib/tokens";
import type { FakePrisma } from "../fake-prisma";
import { fromIp, jsonRequest, linkIn, sentEmails, tokenIn } from "../helpers/routes";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

const db = prisma as unknown as FakePrisma;
const OLD_PASSWORD = "old correct horse battery";
const NEW_PASSWORD = "brand new passphrase 42";

const forgot = (email: unknown, headers: Record<string, string> = {}, url = "http://localhost/api/auth/forgot-password") =>
  forgotRoute(jsonRequest(url, { email }, { headers }));
const reset = (body: unknown, headers: Record<string, string> = {}) => resetRoute(jsonRequest("http://localhost/api/auth/reset-password", body, { headers }));

async function makeUser(overrides: Record<string, unknown> = {}) {
  return db.user.create({ data: { email: "alice@example.com", name: "Alice", passwordHash: await hashPassword(OLD_PASSWORD), ...overrides } });
}
async function issueResetToken(email = "alice@example.com") {
  await forgot(email);
  return tokenIn(sentEmails().at(-1)!);
}

beforeEach(() => {
  db.__reset();
  vi.mocked(sendEmail).mockResolvedValue({ delivered: true, via: "console" });
  vi.stubEnv("NEXTAUTH_URL", "https://app.example.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("forgot password", () => {
  it("emails a reset link to an existing account, stores only a hash of the token", async () => {
    await makeUser();
    const res = await forgot("alice@example.com");
    expect(res.status).toBe(200);

    const mails = sentEmails();
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("alice@example.com");
    expect(linkIn(mails[0])).toMatch(/^https:\/\/app\.example\.test\/reset-password\?token=/);
    const [row] = db.verificationToken.__rows;
    expect(row.identifier).toBe("reset:alice@example.com");
    expect(row.token).not.toBe(tokenIn(mails[0]));
  });

  it("gives the SAME response for an account that exists and one that doesn't, and sends nothing for the latter", async () => {
    await makeUser();
    const real = await forgot("alice@example.com");
    const unknown = await forgot("nobody@example.com");
    expect(unknown.status).toBe(real.status);
    expect(await unknown.json()).toEqual(await real.json());
    expect(sentEmails().map((m) => m.to)).toEqual(["alice@example.com"]);
    expect(db.verificationToken.__rows).toHaveLength(1);
  });

  it("matches the account case-insensitively", async () => {
    await makeUser();
    await forgot("ALICE@Example.COM");
    expect(sentEmails()).toHaveLength(1);
  });

  it("builds the link from the configured site URL, never from the attacker-controllable Host header", async () => {
    await makeUser();
    await forgot("alice@example.com", { host: "evil.example" }, "http://evil.example/api/auth/forgot-password");
    expect(linkIn(sentEmails()[0])).toMatch(/^https:\/\/app\.example\.test\//);
    expect(sentEmails()[0].text).not.toContain("evil.example");
  });

  it("only the newest link works", async () => {
    await makeUser();
    const first = await issueResetToken();
    const second = await issueResetToken();
    expect((await reset({ token: first, password: NEW_PASSWORD })).status).toBe(400);
    expect((await reset({ token: second, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("rate-limits per email - and applies to unknown emails too, so the limit itself can't reveal accounts", async () => {
    await makeUser();
    for (const email of ["alice@example.com", "nobody@example.com"]) {
      for (let i = 0; i < 3; i++) expect((await forgot(email, fromIp(`10.0.${email.length}.${i}`))).status).toBe(200);
      const blocked = await forgot(email, fromIp("10.9.9.9"));
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    }
  });

  it("rate-limits per address across many emails", async () => {
    for (let i = 0; i < 10; i++) expect((await forgot(`u${i}@example.com`, fromIp("198.51.100.5"))).status).toBe(200);
    expect((await forgot("another@example.com", fromIp("198.51.100.5"))).status).toBe(429);
    expect((await forgot("another@example.com", fromIp("198.51.100.6"))).status).toBe(200);
  });

  it("rejects a malformed email", async () => {
    expect((await forgot("not-an-email")).status).toBe(400);
    expect((await forgot(undefined)).status).toBe(400);
  });

  it("answers the same even if the email can't be delivered", async () => {
    await makeUser();
    vi.mocked(sendEmail).mockResolvedValue({ delivered: false, via: "none" });
    const res = await forgot("alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("reset password", () => {
  it("sets the new password, ends all existing sessions, marks the email verified, and burns the link", async () => {
    await makeUser();
    const token = await issueResetToken();
    const before = Date.now();

    const res = await reset({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const [user] = db.user.__rows;
    expect(await verifyPassword(NEW_PASSWORD, user.passwordHash)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, user.passwordHash)).toBe(false);
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(user.sessionsValidAfter.getTime()).toBeGreaterThanOrEqual(before - 1000);

    expect((await reset({ token, password: "another passphrase 99" })).status).toBe(400); // already used
  });

  it("tells the owner their password was changed", async () => {
    await makeUser();
    const token = await issueResetToken();
    vi.mocked(sendEmail).mockClear();
    await reset({ token, password: NEW_PASSWORD });
    expect(sentEmails().map((m) => [m.to, m.subject])).toEqual([["alice@example.com", "Your GenifySuite password was changed"]]);
  });

  it("does NOT burn the link when the new password is too weak - the person can just try again", async () => {
    await makeUser();
    const token = await issueResetToken();
    const weak = await reset({ token, password: "password123" });
    expect(weak.status).toBe(400);
    expect((await weak.json()).error).toMatch(/common/);
    expect(await verifyPassword(OLD_PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);

    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(200);
  });

  it("rejects garbage, empty, and expired tokens with one generic message", async () => {
    await makeUser();
    const messages = new Set<string>();
    for (const token of ["garbage", "", "x".repeat(300)]) {
      const res = await reset({ token, password: NEW_PASSWORD });
      expect(res.status).toBe(400);
      messages.add((await res.json()).error);
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    const stale = await issueResetToken();
    vi.setSystemTime(new Date("2026-09-30T13:00:01Z")); // 1 hour + 1 second later
    const res = await reset({ token: stale, password: NEW_PASSWORD });
    vi.useRealTimers();
    expect(res.status).toBe(400);
    messages.add((await res.json()).error);
    expect(messages.size).toBe(1);
    expect(await verifyPassword(OLD_PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);
  });

  it("can't be done with an email-verification token", async () => {
    await makeUser();
    const verifyToken = await createEmailToken("verify", "alice@example.com");
    expect((await reset({ token: verifyToken, password: NEW_PASSWORD })).status).toBe(400);
    expect(await verifyPassword(OLD_PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);
  });

  it("fails cleanly if the account was deleted after the link was sent", async () => {
    await makeUser();
    const token = await issueResetToken();
    db.user.__rows.length = 0;
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(400);
  });

  it("rejects malformed requests", async () => {
    expect((await reset({ password: NEW_PASSWORD })).status).toBe(400);
    expect((await reset({ token: "abc" })).status).toBe(400);
    expect((await resetRoute(new Request("http://localhost/api/auth/reset-password", { method: "POST", body: "nope" }))).status).toBe(400);
  });

  it("is rate-limited per address", async () => {
    for (let i = 0; i < 20; i++) await reset({ token: `bad${i}`, password: NEW_PASSWORD }, fromIp("192.0.2.1"));
    expect((await reset({ token: "bad", password: NEW_PASSWORD }, fromIp("192.0.2.1"))).status).toBe(429);
  });

  it("works for an OAuth-only account, giving it a password", async () => {
    await makeUser({ passwordHash: null, emailVerified: new Date("2026-01-01") });
    const token = await issueResetToken();
    expect((await reset({ token, password: NEW_PASSWORD })).status).toBe(200);
    expect(await verifyPassword(NEW_PASSWORD, db.user.__rows[0].passwordHash)).toBe(true);
    expect(db.user.__rows[0].emailVerified).toEqual(new Date("2026-01-01")); // earlier timestamp untouched
  });
});
