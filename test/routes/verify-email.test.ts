import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as resendRoute } from "@/app/api/auth/resend-verification/route";
import { POST as verifyRoute } from "@/app/api/auth/verify-email/route";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createEmailToken } from "@/lib/tokens";
import type { FakePrisma } from "../fake-prisma";
import { fromIp, jsonRequest, sentEmails, tokenIn } from "../helpers/routes";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const db = prisma as unknown as FakePrisma;
const verify = (token: unknown, headers: Record<string, string> = {}) => verifyRoute(jsonRequest("http://localhost/api/auth/verify-email", { token }, { headers }));
const resend = () => resendRoute(jsonRequest("http://localhost/api/auth/resend-verification", undefined));
const signedInAs = (id: string) => vi.mocked(getServerSession).mockResolvedValue({ user: { id } } as never);

beforeEach(() => {
  db.__reset();
  vi.mocked(sendEmail).mockResolvedValue({ delivered: true, via: "console" });
  vi.mocked(getServerSession).mockResolvedValue(null as never);
  vi.stubEnv("NEXTAUTH_URL", "https://app.example.test");
});
afterEach(() => vi.unstubAllEnvs());

describe("verify email", () => {
  it("marks the address verified and burns the link", async () => {
    await db.user.create({ data: { email: "alice@example.com" } });
    const token = await createEmailToken("verify", "alice@example.com");

    expect((await verify(token)).status).toBe(200);
    expect(db.user.__rows[0].emailVerified).toBeInstanceOf(Date);
    expect((await verify(token)).status).toBe(400);
  });

  it("never overwrites an earlier verification timestamp", async () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    await db.user.create({ data: { email: "alice@example.com", emailVerified: earlier } });
    await verify(await createEmailToken("verify", "alice@example.com"));
    expect(db.user.__rows[0].emailVerified).toEqual(earlier);
  });

  it("rejects bad, empty and wrong-purpose tokens, changing nothing", async () => {
    await db.user.create({ data: { email: "alice@example.com" } });
    const resetToken = await createEmailToken("reset", "alice@example.com");
    for (const token of ["garbage", "", resetToken, 12345, undefined]) {
      const res = await verify(token);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/invalid or has expired/);
    }
    expect(db.user.__rows[0].emailVerified).toBeNull();
  });

  it("is rate-limited per address", async () => {
    for (let i = 0; i < 30; i++) await verify(`bad${i}`, fromIp("192.0.2.77"));
    expect((await verify("bad", fromIp("192.0.2.77"))).status).toBe(429);
  });
});

describe("resend verification", () => {
  it("requires a signed-in user", async () => {
    expect((await resend()).status).toBe(401);
    expect(sentEmails()).toHaveLength(0);
  });

  it("sends a fresh link to an unverified user, and the old link stops working", async () => {
    const user = await db.user.create({ data: { email: "alice@example.com", name: "Alice" } });
    signedInAs(user.id);
    const original = await createEmailToken("verify", "alice@example.com");

    const res = await resend();
    expect(res.status).toBe(200);
    expect(sentEmails()).toHaveLength(1);
    expect(sentEmails()[0].to).toBe("alice@example.com");

    expect((await verify(original)).status).toBe(400);
    expect((await verify(tokenIn(sentEmails()[0]))).status).toBe(200);
  });

  it("does nothing for someone already verified", async () => {
    const user = await db.user.create({ data: { email: "alice@example.com", emailVerified: new Date() } });
    signedInAs(user.id);
    const res = await resend();
    expect(await res.json()).toEqual({ ok: true, alreadyVerified: true });
    expect(sentEmails()).toHaveLength(0);
  });

  it("is limited to 3 per hour per user", async () => {
    const user = await db.user.create({ data: { email: "alice@example.com" } });
    signedInAs(user.id);
    for (let i = 0; i < 3; i++) expect((await resend()).status).toBe(200);
    const blocked = await resend();
    expect(blocked.status).toBe(429);
    expect(sentEmails()).toHaveLength(3);
  });

  it("reports honestly when the email can't be sent", async () => {
    const user = await db.user.create({ data: { email: "alice@example.com" } });
    signedInAs(user.id);
    vi.mocked(sendEmail).mockResolvedValue({ delivered: false, via: "none" });
    expect((await resend()).status).toBe(502);
  });

  it("treats a session for a deleted account as signed out", async () => {
    signedInAs("user_that_no_longer_exists");
    expect((await resend()).status).toBe(401);
  });
});
