import { getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as ipLookupRoute } from "@/app/api/ip-lookup/route";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const lookup = (query = "?ip=8.8.8.8") => ipLookupRoute(new Request(`http://localhost/api/ip-lookup${query}`));

beforeEach(() => {
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
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "success", query: "8.8.8.8", country: "United States" }) })
    );

    const res = await lookup();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.query).toBe("8.8.8.8");
  });
});
