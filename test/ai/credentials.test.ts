import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRequestDenied, finishAiRequest, resolveAiRequest } from "@/lib/ai/credentials";
import { BYOK_DAILY_LIMIT, SHARED_KEY_DAILY_LIMIT } from "@/lib/ai/usage";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import type { FakePrisma } from "../fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const db = prisma as unknown as FakePrisma;
const signedIn = (id: string, emailVerified = true) => vi.mocked(getServerSession).mockResolvedValue({ user: { id, emailVerified } } as never);
const denied = async (promise: Promise<unknown>) => (await promise.catch((e) => e)) as AiRequestDenied;

async function addKey(userId: string, overrides: Record<string, unknown> = {}) {
  return db.apiKey.create({
    data: { userId, provider: "ANTHROPIC", label: "mine", baseUrl: null, secret: encryptSecret("sk-ant-secret-value"), defaultModel: "claude-sonnet-4-5", ...overrides },
  });
}

beforeEach(() => {
  db.__reset();
  vi.mocked(getServerSession).mockResolvedValue(null as never);
  vi.stubEnv("ENCRYPTION_KEY", "test-encryption-secret-value");
  vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-shared-operator-key");
});
afterEach(() => vi.unstubAllEnvs());

describe("resolveAiRequest: whose key, and are they allowed", () => {
  it("requires sign-in", async () => {
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err).toBeInstanceOf(AiRequestDenied);
    expect(err.status).toBe(401);
  });

  it("resolves the user's own saved key, decrypted, with its provider, model and base URL", async () => {
    signedIn("u1");
    const key = await addKey("u1", { provider: "OLLAMA", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" });
    expect(await resolveAiRequest({ apiKeyId: key.id })).toEqual({
      userId: "u1",
      providerId: "ollama",
      model: "llama3.1",
      credentials: { apiKey: "sk-ant-secret-value", baseUrl: "http://localhost:11434/v1" },
      usingSharedKey: false,
    });
  });

  it("works without a secret for keyless local endpoints", async () => {
    signedIn("u1");
    const key = await addKey("u1", { provider: "OLLAMA", secret: null });
    expect((await resolveAiRequest({ apiKeyId: key.id })).credentials.apiKey).toBeUndefined();
  });

  it("will not hand out ANOTHER user's key, and gives the same answer as for a key that doesn't exist", async () => {
    const theirs = await addKey("u2");
    signedIn("u1");
    const stolen = await denied(resolveAiRequest({ apiKeyId: theirs.id }));
    const missing = await denied(resolveAiRequest({ apiKeyId: "no-such-key" }));
    expect(stolen.status).toBe(404);
    expect(stolen.message).toBe(missing.message);
  });

  it("needs a key id when not using the shared key", async () => {
    signedIn("u1");
    expect((await denied(resolveAiRequest({}))).status).toBe(400);
  });

  it("lets an unverified email use their own key", async () => {
    signedIn("u1", false);
    const key = await addKey("u1");
    expect((await resolveAiRequest({ apiKeyId: key.id })).usingSharedKey).toBe(false);
  });
});

describe("resolveAiRequest: the shared key", () => {
  it("requires a verified email", async () => {
    signedIn("u1", false);
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/Verify your email/);
  });

  it("resolves the operator's key and cheap default model for a verified user", async () => {
    signedIn("u1");
    expect(await resolveAiRequest({ useShared: true })).toMatchObject({
      providerId: "anthropic",
      model: "claude-haiku-4-5",
      credentials: { apiKey: "sk-ant-shared-operator-key" },
      usingSharedKey: true,
    });
  });

  it("explains when this deployment has no shared key", async () => {
    signedIn("u1");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(503);
  });
});

describe("resolveAiRequest: limits", () => {
  it("applies the per-minute burst limit (6 shared, 20 own key) with a retry hint", async () => {
    signedIn("u1");
    for (let i = 0; i < 6; i++) await resolveAiRequest({ useShared: true });
    // The 7th hits the per-minute burst limit. (The 3-a-day free allowance isn't spent until requests SUCCEED.)
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(err.retryAfterSeconds).toBeLessThanOrEqual(60);

    signedIn("u2");
    const key = await addKey("u2");
    for (let i = 0; i < 20; i++) await resolveAiRequest({ apiKeyId: key.id });
    expect((await denied(resolveAiRequest({ apiKeyId: key.id }))).status).toBe(429);
  });

  it("enforces the free tier's daily shared-key allowance - counted on success, not on attempt", async () => {
    signedIn("u1");
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) {
      const resolved = await resolveAiRequest({ useShared: true });
      await finishAiRequest(resolved);
    }
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/shared key/);
  });

  it("gives a paying tier a bigger allowance", async () => {
    signedIn("u1");
    await db.subscription.create({ data: { userId: "u1", tier: "STARTER" } });
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE + 2; i++) await finishAiRequest(await resolveAiRequest({ useShared: true }));
    expect((await resolveAiRequest({ useShared: true })).usingSharedKey).toBe(true);
  });

  it("keeps the shared and own-key daily counters apart", async () => {
    signedIn("u1");
    const key = await addKey("u1");
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) await finishAiRequest({ userId: "u1", usingSharedKey: true });
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);
    expect((await resolveAiRequest({ apiKeyId: key.id })).usingSharedKey).toBe(false); // own key unaffected
    expect(db.aiUsage.__rows.map((r) => [r.source, r.count])).toEqual([["shared", SHARED_KEY_DAILY_LIMIT.FREE]]);
  });

  it("applies the flat daily guard to own-key use", async () => {
    signedIn("u1");
    const key = await addKey("u1");
    for (let i = 0; i < BYOK_DAILY_LIMIT; i++) await finishAiRequest({ userId: "u1", usingSharedKey: false });
    const err = await denied(resolveAiRequest({ apiKeyId: key.id }));
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/Daily limit reached/);
  });

  it("keeps working if the rate limiter's table is unavailable", async () => {
    signedIn("u1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.rateLimit, "upsert").mockRejectedValue(new Error("no such table"));
    expect((await resolveAiRequest({ useShared: true })).usingSharedKey).toBe(true);
  });
});
