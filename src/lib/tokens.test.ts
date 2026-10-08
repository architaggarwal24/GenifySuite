import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { TOKEN_TTL_MS, consumeEmailToken, createEmailToken, hashToken } from "./tokens";
import type { FakePrisma } from "../../test/fake-prisma";

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../../test/fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
beforeEach(() => db.__reset());

describe("email tokens", () => {
  it("round-trips: the token issued for an email redeems to that email", async () => {
    const raw = await createEmailToken("reset", "Alice@Example.com", T0);
    expect(await consumeEmailToken("reset", raw, T0 + 1000)).toBe("alice@example.com");
  });

  it("stores only a hash, never the token that goes in the email", async () => {
    const raw = await createEmailToken("verify", "a@example.com", T0);
    const [row] = db.verificationToken.__rows;
    expect(row.token).toBe(hashToken(raw));
    expect(row.token).not.toBe(raw);
    expect(JSON.stringify(db.verificationToken.__rows)).not.toContain(raw);
  });

  it("is single-use", async () => {
    const raw = await createEmailToken("reset", "a@example.com", T0);
    expect(await consumeEmailToken("reset", raw, T0)).toBe("a@example.com");
    expect(await consumeEmailToken("reset", raw, T0)).toBeNull();
  });

  it("expires (verify after 24h, reset after 1h) and is consumed even when expired", async () => {
    const reset = await createEmailToken("reset", "a@example.com", T0);
    expect(await consumeEmailToken("reset", reset, T0 + TOKEN_TTL_MS.reset + 1)).toBeNull();
    expect(db.verificationToken.__rows).toHaveLength(0);

    const verify = await createEmailToken("verify", "a@example.com", T0);
    expect(await consumeEmailToken("verify", verify, T0 + TOKEN_TTL_MS.reset + 1)).toBe("a@example.com"); // still fine after an hour
    const late = await createEmailToken("verify", "a@example.com", T0);
    expect(await consumeEmailToken("verify", late, T0 + TOKEN_TTL_MS.verify + 1)).toBeNull();
  });

  it("can't be redeemed for the wrong purpose, and a wrong-purpose attempt doesn't destroy it", async () => {
    const raw = await createEmailToken("reset", "a@example.com", T0);
    expect(await consumeEmailToken("verify", raw, T0)).toBeNull();
    expect(await consumeEmailToken("reset", raw, T0)).toBe("a@example.com");
  });

  it("keeps only the latest token per purpose and email", async () => {
    const first = await createEmailToken("reset", "a@example.com", T0);
    const second = await createEmailToken("reset", "a@example.com", T0 + 1000);
    expect(await consumeEmailToken("reset", first, T0 + 2000)).toBeNull();
    expect(await consumeEmailToken("reset", second, T0 + 2000)).toBe("a@example.com");
  });

  it("doesn't let one purpose's new token wipe out the other purpose's", async () => {
    const verify = await createEmailToken("verify", "a@example.com", T0);
    await createEmailToken("reset", "a@example.com", T0);
    expect(await consumeEmailToken("verify", verify, T0)).toBe("a@example.com");
  });

  it("rejects unknown, empty and oversized tokens", async () => {
    expect(await consumeEmailToken("reset", "not-a-real-token")).toBeNull();
    expect(await consumeEmailToken("reset", "")).toBeNull();
    expect(await consumeEmailToken("reset", "x".repeat(500))).toBeNull();
  });

  it("generates unguessable, distinct tokens", async () => {
    const tokens = await Promise.all(Array.from({ length: 20 }, (_, i) => createEmailToken("reset", `u${i}@example.com`, T0)));
    expect(new Set(tokens).size).toBe(20);
    tokens.forEach((t) => expect(t.length).toBeGreaterThanOrEqual(43)); // 32 random bytes, base64url
  });

  it("lets only one of two simultaneous redemptions succeed", async () => {
    const raw = await createEmailToken("reset", "a@example.com", T0);
    const results = await Promise.all([consumeEmailToken("reset", raw, T0), consumeEmailToken("reset", raw, T0)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
