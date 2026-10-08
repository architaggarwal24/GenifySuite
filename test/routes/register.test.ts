import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/passwords";
import { consumeEmailToken } from "@/lib/tokens";
import type { FakePrisma } from "../fake-prisma";
import { fromIp, jsonRequest, sentEmails, tokenIn } from "../helpers/routes";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

const db = prisma as unknown as FakePrisma;
const valid = { name: "Alice", email: "alice@example.com", password: "correct horse battery" };
const register = (body: unknown, headers: Record<string, string> = {}) => POST(jsonRequest("http://localhost/api/auth/register", body, { headers }));

beforeEach(() => {
  db.__reset();
  vi.mocked(sendEmail).mockResolvedValue({ delivered: true, via: "console" });
  vi.stubEnv("NEXTAUTH_URL", "https://app.example.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("register", () => {
  it("creates the account with a hashed password and an unverified email", async () => {
    const res = await register(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, verificationEmailSent: true });

    const [user] = db.user.__rows;
    expect(user).toMatchObject({ email: "alice@example.com", name: "Alice", emailVerified: null });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword(valid.password, user.passwordHash)).toBe(true);
    expect(JSON.stringify(db.user.__rows)).not.toContain(valid.password);
  });

  it("emails a verification link whose token redeems to that address", async () => {
    await register(valid);
    const [mail] = sentEmails();
    expect(sentEmails()).toHaveLength(1);
    expect(mail.to).toBe("alice@example.com");
    expect(mail.text).toContain("https://app.example.test/verify-email?token=");
    expect(await consumeEmailToken("verify", tokenIn(mail))).toBe("alice@example.com");
  });

  it("normalises the email address", async () => {
    await register({ ...valid, email: "  Alice@Example.COM " });
    expect(db.user.__rows[0].email).toBe("alice@example.com");
  });

  it("refuses a duplicate email (any capitalisation) without sending another email", async () => {
    await register(valid);
    const again = await register({ ...valid, email: "ALICE@example.com" });
    expect(again.status).toBe(409);
    expect(db.user.__rows).toHaveLength(1);
    expect(sentEmails()).toHaveLength(1);
  });

  it("returns 409, not a crash, when two sign-ups race past the existence check", async () => {
    await db.user.create({ data: { email: "alice@example.com", name: "Existing" } });
    vi.spyOn(db.user, "findUnique").mockResolvedValueOnce(null); // the check says "free" ...
    const res = await register(valid); // ... but the unique index disagrees
    expect(res.status).toBe(409);
    expect(db.user.__rows).toHaveLength(1);
  });

  it.each([
    ["too short", "short1"],
    ["a common password", "password123"],
    ["over bcrypt's 72-byte limit", "a1".repeat(37)],
    ["containing the email name", "my-alice-passphrase"],
  ])("rejects a weak password (%s) and creates nothing", async (_label, password) => {
    const res = await register({ ...valid, password });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
    expect(db.user.__rows).toHaveLength(0);
    expect(sentEmails()).toHaveLength(0);
  });

  it.each([
    ["missing name", { email: "a@example.com", password: "correct horse battery" }],
    ["bad email", { name: "A", email: "not-an-email", password: "correct horse battery" }],
    ["missing password", { name: "A", email: "a@example.com" }],
    ["non-JSON body", "garbage"],
  ])("rejects invalid input: %s", async (_label, body) => {
    const res = await POST(new Request("http://localhost/api/auth/register", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
    expect(res.status).toBe(400);
    expect(db.user.__rows).toHaveLength(0);
  });

  it("rate-limits sign-ups per address, with a Retry-After header, without affecting other addresses", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await register({ ...valid, email: `user${i}@example.com` }, fromIp("203.0.113.1"))).status).toBe(200);
    }
    const blocked = await register({ ...valid, email: "user99@example.com" }, fromIp("203.0.113.1"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(db.user.__rows).toHaveLength(10);

    expect((await register({ ...valid, email: "other@example.com" }, fromIp("203.0.113.2"))).status).toBe(200);
  });

  it("doesn't lump visitors with no detectable address into one shared limit", async () => {
    for (let i = 0; i < 12; i++) expect((await register({ ...valid, email: `u${i}@example.com` })).status).toBe(200);
  });

  it("still creates the account if the email can't be sent, and says so", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ delivered: false, via: "none" });
    const res = await register(valid);
    expect(res.status).toBe(200);
    expect((await res.json()).verificationEmailSent).toBe(false);
    expect(db.user.__rows).toHaveLength(1);
  });

  it("doesn't build a link from the request's Host header when the site URL isn't configured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXTAUTH_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(jsonRequest("https://evil.example/api/auth/register", valid, { headers: { host: "evil.example" } }));
    expect((await res.json()).verificationEmailSent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
