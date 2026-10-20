import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, peekRateLimit, refundRateLimit } from "./rate-limit";
import type { FakePrisma } from "../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
const T0 = Date.UTC(2026, 8, 30, 12, 0, 10); // 12:00:10 UTC

beforeEach(() => db.__reset());

describe("consumeRateLimit", () => {
  it("allows exactly `limit` requests per window, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 8; i++) results.push(await consumeRateLimit("t", "u1", 5, 60, T0));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false, false, false]);
    expect(results.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0, 0, 0, 0]);
  });

  it("tells the caller how long until the window resets", async () => {
    const r = await consumeRateLimit("t", "u1", 1, 60, T0); // 12:00:10 -> window ends 12:01:00
    expect(r.retryAfterSeconds).toBe(50);
    const edge = await consumeRateLimit("t", "u2", 1, 60, Date.UTC(2026, 8, 30, 12, 0, 59, 500));
    expect(edge.retryAfterSeconds).toBe(1);
  });

  it("starts a fresh allowance in the next window", async () => {
    for (let i = 0; i < 3; i++) await consumeRateLimit("t", "u1", 2, 60, T0);
    expect((await consumeRateLimit("t", "u1", 2, 60, T0)).allowed).toBe(false);
    expect((await consumeRateLimit("t", "u1", 2, 60, T0 + 60_000)).allowed).toBe(true);
  });

  it("keeps scopes and ids independent", async () => {
    await consumeRateLimit("a", "u1", 1, 60, T0);
    expect((await consumeRateLimit("a", "u1", 1, 60, T0)).allowed).toBe(false);
    expect((await consumeRateLimit("b", "u1", 1, 60, T0)).allowed).toBe(true);
    expect((await consumeRateLimit("a", "u2", 1, 60, T0)).allowed).toBe(true);
  });

  it("cannot be raced past the limit by concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeRateLimit("t", "u1", 5, 60, T0)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("fails open (and logs) when the store is unavailable, instead of breaking the request", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.rateLimit, "upsert").mockRejectedValue(new Error("relation \"RateLimit\" does not exist"));
    const r = await consumeRateLimit("t", "u1", 5, 60, T0 + 10 * 60_000);
    expect(r).toMatchObject({ allowed: true, degraded: true });
    expect(spy).toHaveBeenCalled();
  });
});

describe("peekRateLimit", () => {
  it("does not count anything", async () => {
    for (let i = 0; i < 10; i++) await peekRateLimit("t", "u1", 2, 60, T0);
    expect(db.rateLimit.__rows).toHaveLength(0);
    expect((await peekRateLimit("t", "u1", 2, 60, T0)).allowed).toBe(true);
  });

  it("blocks once `limit` events have been consumed", async () => {
    await consumeRateLimit("t", "u1", 2, 60, T0);
    expect((await peekRateLimit("t", "u1", 2, 60, T0)).allowed).toBe(true); // 1 of 2 used: one more is fine
    await consumeRateLimit("t", "u1", 2, 60, T0);
    const blocked = await peekRateLimit("t", "u1", 2, 60, T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it("fails open when the store is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.rateLimit, "findUnique").mockRejectedValue(new Error("db down"));
    expect(await peekRateLimit("t", "u1", 2, 60, T0 + 20 * 60_000)).toMatchObject({ allowed: true, degraded: true });
  });
});

describe("refundRateLimit", () => {
  it("gives back one unit of the current window", async () => {
    for (let i = 0; i < 5; i++) await consumeRateLimit("t", "u1", 5, 60, T0);
    expect((await consumeRateLimit("t", "u1", 5, 60, T0)).allowed).toBe(false); // 6th: over
    await refundRateLimit("t", "u1", 60, T0); // 6 -> 5
    await refundRateLimit("t", "u1", 60, T0); // 5 -> 4
    expect((await consumeRateLimit("t", "u1", 5, 60, T0)).allowed).toBe(true); // 4 -> 5
  });

  it("never goes below zero and ignores a window with no row", async () => {
    await refundRateLimit("t", "nobody", 60, T0);
    await consumeRateLimit("t", "u1", 5, 60, T0);
    await refundRateLimit("t", "u1", 60, T0);
    await refundRateLimit("t", "u1", 60, T0);
    await refundRateLimit("t", "u1", 60, T0);
    expect((await peekRateLimit("t", "u1", 5, 60, T0)).remaining).toBe(5);
  });

  it("only touches its own scope and id", async () => {
    await consumeRateLimit("t", "u1", 5, 60, T0);
    await consumeRateLimit("t", "u2", 5, 60, T0);
    await refundRateLimit("t", "u1", 60, T0);
    expect((await peekRateLimit("t", "u2", 5, 60, T0)).remaining).toBe(4);
  });

  it("swallows store errors instead of breaking the request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db.rateLimit, "updateMany").mockRejectedValue(new Error("no such table"));
    await expect(refundRateLimit("t", "u1", 60, T0)).resolves.toBeUndefined();
  });
});

describe("housekeeping", () => {
  it("prunes old short windows but keeps long-lived rows like the 30-day known-device markers", async () => {
    const day = 24 * 60 * 60 * 1000;
    db.rateLimit.__rows.push({ key: "t:old:1", count: 3, windowStart: new Date(T0 - 2 * day) });
    db.rateLimit.__rows.push({ key: "login-known:a@b.c|1.2.3.4:1", count: 1, windowStart: new Date(T0 - 10 * day) });
    db.rateLimit.__rows.push({ key: "login-known:old@b.c|1.2.3.4:1", count: 1, windowStart: new Date(T0 - 40 * day) });
    vi.spyOn(Math, "random").mockReturnValue(0); // always run the housekeeping branch

    await consumeRateLimit("t", "u1", 5, 60, T0);
    await new Promise((resolve) => setTimeout(resolve, 0)); // the prune is fire-and-forget

    const keys = db.rateLimit.__rows.map((r) => r.key);
    expect(keys).not.toContain("t:old:1");
    expect(keys).toContain("login-known:a@b.c|1.2.3.4:1");
    expect(keys).not.toContain("login-known:old@b.c|1.2.3.4:1");
  });
});
