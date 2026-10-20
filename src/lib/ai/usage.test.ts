import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { BYOK_DAILY_LIMIT, SHARED_KEY_DAILY_LIMIT, checkUsage, recordUsage, releaseUsage, reserveUsage } from "./usage";
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

describe("reserveUsage: take the allowance BEFORE the provider is called", () => {
  const limit = SHARED_KEY_DAILY_LIMIT.FREE;

  it("grants up to the limit, then refuses without letting the counter creep past it", async () => {
    for (let i = 0; i < limit; i++) expect((await reserveUsage("u1", true, "FREE")).allowed).toBe(true);
    for (let i = 0; i < 5; i++) expect((await reserveUsage("u1", true, "FREE")).allowed).toBe(false);
    expect(db.aiUsage.__rows.map((r) => r.count)).toEqual([limit]);
  });

  it("cannot be raced past the limit by parallel requests", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => reserveUsage("u1", true, "FREE")));
    expect(results.filter((r) => r.allowed)).toHaveLength(limit);
    expect(db.aiUsage.__rows.map((r) => r.count)).toEqual([limit]);
  });

  it("reports what is left", async () => {
    expect(await reserveUsage("u1", true, "FREE")).toEqual({ allowed: true, remaining: limit - 1, limit });
  });

  it("keeps shared and own-key counters apart, and users apart", async () => {
    for (let i = 0; i < limit; i++) await reserveUsage("u1", true, "FREE");
    expect((await reserveUsage("u1", false, "FREE")).allowed).toBe(true);
    expect((await reserveUsage("u2", true, "FREE")).allowed).toBe(true);
  });

  it("applies the flat guard to own-key use", async () => {
    for (let i = 0; i < BYOK_DAILY_LIMIT; i++) await reserveUsage("u1", false, "PRO");
    expect((await reserveUsage("u1", false, "PRO")).allowed).toBe(false);
  });
});

describe("releaseUsage: give back a reservation that cost nothing", () => {
  it("frees one slot, and never goes below zero", async () => {
    await reserveUsage("u1", true, "FREE");
    await releaseUsage("u1", true);
    await releaseUsage("u1", true);
    expect(db.aiUsage.__rows.map((r) => r.count)).toEqual([0]);
    expect((await checkUsage("u1", true, "FREE")).remaining).toBe(SHARED_KEY_DAILY_LIMIT.FREE);
  });
  it("does nothing when there is no row", async () => {
    await expect(releaseUsage("nobody", true)).resolves.toBeUndefined();
  });
});
