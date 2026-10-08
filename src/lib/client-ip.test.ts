import { describe, expect, it } from "vitest";
import { getClientIp, ipFromRequest } from "./client-ip";

const from = (headers: Record<string, string>) => getClientIp((name) => headers[name]);

describe("client IP", () => {
  it("takes the first address from a forwarded chain", () => {
    expect(from({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" })).toBe("203.0.113.7");
  });

  it("prefers the platform header over x-forwarded-for, and x-forwarded-for over x-real-ip", () => {
    expect(from({ "x-vercel-forwarded-for": "198.51.100.1", "x-forwarded-for": "203.0.113.7" })).toBe("198.51.100.1");
    expect(from({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "192.0.2.5" })).toBe("203.0.113.7");
    expect(from({ "x-real-ip": "192.0.2.5" })).toBe("192.0.2.5");
  });

  it("returns null when there is no address, so callers skip the IP limit instead of pooling everyone", () => {
    expect(from({})).toBeNull();
    expect(from({ "x-forwarded-for": "   " })).toBeNull();
  });

  it("limits the length of what it will use as a key", () => {
    expect(from({ "x-forwarded-for": "a".repeat(500) })).toHaveLength(64);
  });

  it("works with a Request", () => {
    expect(ipFromRequest(new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.9" } }))).toBe("203.0.113.9");
  });
});
