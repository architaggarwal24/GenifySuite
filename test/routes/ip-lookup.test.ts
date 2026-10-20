import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as ipLookupRoute } from "@/app/api/ip-lookup/route";
import { prisma } from "@/lib/prisma";
import type { FakePrisma } from "../fake-prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("../fake-prisma");
  return { prisma: createFakePrisma() };
});

const db = prisma as unknown as FakePrisma;
const lookup = (query = "?ip=8.8.8.8") => ipLookupRoute(new Request(`http://localhost/api/ip-lookup${query}`));
const signIn = (id = "user-1") => vi.mocked(getServerSession).mockResolvedValue({ user: { id } } as never);
const upstreamOk = () =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", query: "8.8.8.8", country: "United States" }) }));

beforeEach(() => {
  db.__reset();
  vi.mocked(getServerSession).mockResolvedValue(null as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/ip-lookup", () => {
  it("rejects signed-out requests before calling the upstream service", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await lookup();

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("looks the address up for a signed-in user", async () => {
    signIn();
    upstreamOk();

    const res = await lookup();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.query).toBe("8.8.8.8");
  });

  it("limits each user, so one account can't burn through the shared upstream allowance", async () => {
    signIn("user-1");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", query: "8.8.8.8" }) });
    vi.stubGlobal("fetch", fetchSpy);

    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) statuses.push((await lookup()).status);

    expect(statuses.filter((s) => s === 200)).toHaveLength(15);
    expect(statuses.filter((s) => s === 429)).toHaveLength(5);
    expect(fetchSpy).toHaveBeenCalledTimes(15); // refused requests never reach the upstream service
    const refused = await lookup();
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("caps the whole app's calls to the upstream service, whoever is asking", async () => {
    upstreamOk();
    let refused = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 8; j++) {
        signIn(`user-${i}`);
        if ((await lookup()).status === 429) refused++;
      }
    }
    expect(refused).toBeGreaterThan(0); // 48 requests across 6 users is over the shared cap (40/min)
  });

  it("requests refused for ONE user don't use up the shared cap, so one person can't block the tool for everyone", async () => {
    upstreamOk();
    signIn("spammer");
    for (let i = 0; i < 100; i++) await lookup();
    signIn("someone-else");
    expect((await lookup()).status).toBe(200);
  });
});
