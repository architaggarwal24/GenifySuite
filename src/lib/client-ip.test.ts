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

describe("client IP trust (production)", () => {
  const prod = (headers: Record<string, string>, extra: Record<string, string> = {}) =>
    getClientIp((name) => headers[name], { NODE_ENV: "production", ...extra });

  it("uses only the header the operator says their edge sets, ignoring forged ones", () => {
    const headers = { "cf-connecting-ip": "198.51.100.9", "x-forwarded-for": "6.6.6.6", "x-vercel-forwarded-for": "7.7.7.7" };
    expect(prod(headers, { GENIFY_TRUSTED_IP_HEADER: "cf-connecting-ip" })).toBe("198.51.100.9");
  });

  it("with a configured x-forwarded-for, trusts the entry the closest proxy appended, not the client-supplied first one", () => {
    expect(prod({ "x-forwarded-for": "6.6.6.6, 198.51.100.9" }, { GENIFY_TRUSTED_IP_HEADER: "x-forwarded-for" })).toBe("198.51.100.9");
    // two trusted proxies in a row: the client is the second entry from the right
    expect(prod({ "x-forwarded-for": "6.6.6.6, 198.51.100.9, 10.0.0.2" }, { GENIFY_TRUSTED_IP_HEADER: "x-forwarded-for", GENIFY_TRUSTED_PROXY_HOPS: "2" })).toBe("198.51.100.9");
  });

  it("on Vercel, uses the platform header it overwrites itself", () => {
    expect(prod({ "x-vercel-forwarded-for": "198.51.100.1", "x-forwarded-for": "6.6.6.6" }, { VERCEL: "1" })).toBe("198.51.100.1");
  });

  it("unconfigured elsewhere: a client-sent x-vercel-forwarded-for is ignored, and the proxy-appended (rightmost) address wins", () => {
    expect(prod({ "x-vercel-forwarded-for": "7.7.7.7", "x-forwarded-for": "6.6.6.6, 198.51.100.9" })).toBe("198.51.100.9");
    expect(prod({ "x-forwarded-for": "198.51.100.9" })).toBe("198.51.100.9");
    expect(prod({ "x-real-ip": "192.0.2.5" })).toBe("192.0.2.5");
  });

  it("unconfigured with nothing trustworthy: null, so callers skip the IP limit", () => {
    expect(prod({ "cf-connecting-ip": "6.6.6.6" })).toBeNull();
    expect(prod({})).toBeNull();
  });
});

