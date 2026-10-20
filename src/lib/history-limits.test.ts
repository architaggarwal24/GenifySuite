import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkHistoryWrite } from "./history-limits";
import { HISTORY_LIMITS } from "./limits";
import type { FakePrisma } from "../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
beforeEach(() => db.__reset());

describe("checkHistoryWrite", () => {
  it("lets an ordinary save through", async () => {
    expect(await checkHistoryWrite("u1", { items: ["a", "b"] })).toEqual({ ok: true });
  });

  it("rejects a missing payload", async () => {
    expect(await checkHistoryWrite("u1", undefined)).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects an oversized payload", async () => {
    const big = { blob: "x".repeat(HISTORY_LIMITS.maxPayloadChars) };
    expect(await checkHistoryWrite("u1", big)).toMatchObject({ ok: false, status: 413 });
  });

  it("stops a user filling the database: a cap on saved items per user", async () => {
    for (let i = 0; i < HISTORY_LIMITS.maxItems; i++) db.historyItem.__rows.push({ id: `h${i}`, userId: "u1" });
    expect(await checkHistoryWrite("u1", { a: 1 })).toMatchObject({ ok: false, status: 409 });
    expect(await checkHistoryWrite("u2", { a: 1 })).toEqual({ ok: true }); // someone else is unaffected
  });

  it("rate-limits rapid-fire saves", async () => {
    let last: unknown;
    for (let i = 0; i < 61; i++) last = await checkHistoryWrite("u1", { a: i });
    expect(last).toMatchObject({ ok: false, status: 429 });
  });
});
