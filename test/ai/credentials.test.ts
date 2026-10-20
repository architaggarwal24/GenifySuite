import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiRequestDenied, refundAiRequest, refundIfFree, resolveAiRequest } from "@/lib/ai/credentials";
import { AiOutputError } from "@/lib/ai/errors";
import { BYOK_DAILY_LIMIT, SHARED_KEY_DAILY_LIMIT, recordUsage } from "@/lib/ai/usage";
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
    await db.subscription.create({ data: { userId: "u1", tier: "STARTER" } }); // big enough daily allowance that the burst limit is what trips
    for (let i = 0; i < 6; i++) await resolveAiRequest({ useShared: true });
    // The 7th hits the per-minute burst limit.
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(err.retryAfterSeconds).toBeLessThanOrEqual(60);

    signedIn("u2");
    const key = await addKey("u2");
    for (let i = 0; i < 20; i++) await resolveAiRequest({ apiKeyId: key.id });
    expect((await denied(resolveAiRequest({ apiKeyId: key.id }))).status).toBe(429);
  });

  it("enforces the free tier's daily shared-key allowance - taken when the request is accepted, so a dropped connection can't dodge it", async () => {
    signedIn("u1");
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) await resolveAiRequest({ useShared: true });
    const err = await denied(resolveAiRequest({ useShared: true }));
    expect(err.status).toBe(429);
    expect(err.message).toMatch(/shared key/);
  });

  it("gives a paying tier a bigger allowance", async () => {
    signedIn("u1");
    await db.subscription.create({ data: { userId: "u1", tier: "STARTER" } });
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE + 2; i++) await resolveAiRequest({ useShared: true });
    expect((await resolveAiRequest({ useShared: true })).usingSharedKey).toBe(true);
  });

  it("keeps the shared and own-key daily counters apart", async () => {
    signedIn("u1");
    const key = await addKey("u1");
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) await recordUsage("u1", true);
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);
    expect((await resolveAiRequest({ apiKeyId: key.id })).usingSharedKey).toBe(false); // own key unaffected
    expect(db.aiUsage.__rows.map((r) => [r.source, r.count])).toEqual([
      ["shared", SHARED_KEY_DAILY_LIMIT.FREE],
      ["byok", 1], // taken when the own-key request was accepted
    ]);
  });

  it("applies the flat daily guard to own-key use", async () => {
    signedIn("u1");
    const key = await addKey("u1");
    for (let i = 0; i < BYOK_DAILY_LIMIT; i++) await recordUsage("u1", false);
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

describe("resolveAiRequest: the allowance can't be dodged", () => {
  it("parallel requests can't exceed the daily allowance", async () => {
    signedIn("u1");
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => resolveAiRequest({ useShared: true })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(SHARED_KEY_DAILY_LIMIT.FREE);
  });

  it("refundAiRequest gives back a slot for a request that cost nothing", async () => {
    signedIn("u1");
    const taken = [];
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) taken.push(await resolveAiRequest({ useShared: true }));
    await refundAiRequest(taken[0]);
    expect((await resolveAiRequest({ useShared: true })).usingSharedKey).toBe(true);
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);
  });

  it("a subscription that is failing payment does not keep the paid allowance", async () => {
    signedIn("u1");
    await db.subscription.create({ data: { userId: "u1", tier: "PRO", status: "past_due" } });
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE; i++) await resolveAiRequest({ useShared: true });
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);
  });

  it("a subscription in good standing does", async () => {
    signedIn("u1");
    await db.subscription.create({ data: { userId: "u1", tier: "STARTER", status: "active" } });
    for (let i = 0; i < SHARED_KEY_DAILY_LIMIT.FREE + 2; i++) await resolveAiRequest({ useShared: true });
  });
});

describe("refundIfFree: only failures that cost nothing give the allowance back", () => {
  it("refunds a network failure but not a bad model output or a dropped connection", async () => {
    signedIn("u1");
    const a = await resolveAiRequest({ useShared: true });
    const b = await resolveAiRequest({ useShared: true });
    const c = await resolveAiRequest({ useShared: true });
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);

    await refundIfFree(a, new AiOutputError("not json")); // the model ran: stays counted
    await refundIfFree(b, Object.assign(new Error("aborted"), { name: "AbortError" })); // client left: stays counted
    expect((await denied(resolveAiRequest({ useShared: true }))).status).toBe(429);

    await refundIfFree(c, new TypeError("fetch failed")); // never reached the model: given back
    expect((await resolveAiRequest({ useShared: true })).usingSharedKey).toBe(true);
  });

  it("does nothing when the request was never resolved", async () => {
    await expect(refundIfFree(undefined, new TypeError("fetch failed"))).resolves.toBeUndefined();
  });
});

