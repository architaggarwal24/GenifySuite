import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { BYOK_DAILY_LIMIT, SHARED_KEY_DAILY_LIMIT, checkUsage, recordUsage } from "./usage";
import type { FakePrisma } from "../../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
beforeEach(() => db.__reset());
afterEach(() => vi.useRealTimers());

async function use(userId: string, shared: boolean, times: number) {
  for (let i = 0; i < times; i++) await recordUsage(userId, shared);
}

describe("daily usage caps", () => {
  it("tiers get progressively larger shared-key allowances", () => {
    expect(SHARED_KEY_DAILY_LIMIT.FREE).toBeGreaterThan(0);
    expect(SHARED_KEY_DAILY_LIMIT.STARTER).toBeGreaterThan(SHARED_KEY_DAILY_LIMIT.FREE);
    expect(SHARED_KEY_DAILY_LIMIT.PRO).toBeGreaterThan(SHARED_KEY_DAILY_LIMIT.STARTER);
  });

  it("allows requests up to the limit and blocks the next one", async () => {
    const limit = SHARED_KEY_DAILY_LIMIT.FREE;
    await use("u1", true, limit - 1);
    expect(await checkUsage("u1", true, "FREE")).toEqual({ allowed: true, remaining: 1, limit });
    await use("u1", true, 1);
    expect(await checkUsage("u1", true, "FREE")).toEqual({ allowed: false, remaining: 0, limit });
  });

  it("applies the limit for the user's tier", async () => {
    await use("u1", true, SHARED_KEY_DAILY_LIMIT.FREE);
    expect((await checkUsage("u1", true, "FREE")).allowed).toBe(false);
    expect((await checkUsage("u1", true, "STARTER")).allowed).toBe(true);
    expect((await checkUsage("u1", true, "PRO")).allowed).toBe(true);
  });

  it("keeps the shared-key allowance and the bring-your-own-key allowance SEPARATE", async () => {
    // A free user working through their OWN key must not burn the shared-key trial...
    await use("u1", false, SHARED_KEY_DAILY_LIMIT.FREE + 5);
    expect((await checkUsage("u1", true, "FREE")).allowed).toBe(true);
    expect((await checkUsage("u1", true, "FREE")).remaining).toBe(SHARED_KEY_DAILY_LIMIT.FREE);

    // ...and shared-key usage must not eat into the bring-your-own-key allowance.
    await use("u2", true, SHARED_KEY_DAILY_LIMIT.FREE);
    expect((await checkUsage("u2", false, "FREE")).remaining).toBe(BYOK_DAILY_LIMIT);
  });

  it("applies the flat abuse guard to BYOK regardless of tier", async () => {
    await use("u1", false, BYOK_DAILY_LIMIT);
    expect((await checkUsage("u1", false, "PRO")).allowed).toBe(false);
    expect((await checkUsage("u1", false, "FREE")).limit).toBe(BYOK_DAILY_LIMIT);
  });

  it("counts per user", async () => {
    await use("u1", true, SHARED_KEY_DAILY_LIMIT.FREE);
    expect((await checkUsage("u2", true, "FREE")).allowed).toBe(true);
  });

  it("resets at the UTC day boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T23:59:00Z"));
    await use("u1", true, SHARED_KEY_DAILY_LIMIT.FREE);
    expect((await checkUsage("u1", true, "FREE")).allowed).toBe(false);
    vi.setSystemTime(new Date("2026-10-01T00:00:01Z"));
    expect((await checkUsage("u1", true, "FREE")).allowed).toBe(true);
  });
});
