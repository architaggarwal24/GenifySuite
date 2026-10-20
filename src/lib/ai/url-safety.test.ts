import { describe, expect, it, vi } from "vitest";
import { checkProviderBaseUrl, defaultUrlPolicy, resolveProviderUrl, UnsafeProviderUrlError } from "./url-safety";

const STRICT = { allowPrivate: false };
const LOOSE = { allowPrivate: true };
const ok = (raw: string, policy = STRICT) => checkProviderBaseUrl(raw, policy);

describe("provider base URL policy (strict, as in production)", () => {
  it("accepts normal public https endpoints and trims trailing slashes", () => {
    expect(ok("https://api.openai.com/v1")).toEqual({ ok: true, url: "https://api.openai.com/v1" });
    expect(ok("https://api.example.com/v1/")).toEqual({ ok: true, url: "https://api.example.com/v1" });
    expect(ok("https://gateway.example.com:8443/anthropic")).toMatchObject({ ok: true });
    expect(ok("https://8.8.8.8/v1")).toMatchObject({ ok: true });
    expect(ok("https://172.32.0.1/v1")).toMatchObject({ ok: true }); // just outside 172.16/12
    expect(ok("https://[2606:4700::1111]/v1")).toMatchObject({ ok: true });
  });

  it.each([
    "http://api.example.com/v1",
    "ftp://api.example.com/v1",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "not a url",
    "",
    "https://user:pass@api.example.com/v1",
    "https://api.example.com/v1?x=1",
    "https://api.example.com/v1?",
    "https://api.example.com/v1#frag",
  ])("rejects %s", (raw) => {
    expect(ok(raw).ok).toBe(false);
  });

  it.each([
    "https://localhost/v1",
    "https://foo.localhost/v1",
    "https://metadata.google.internal/v1",
    "https://printer.local/v1",
    "https://redis/v1", // single-label name: only resolves inside a private network
    "https://127.0.0.1/v1",
    "https://127.255.255.254/v1",
    "https://0.0.0.0/v1",
    "https://10.0.0.5/v1",
    "https://172.16.0.1/v1",
    "https://172.31.255.255/v1",
    "https://192.168.1.1/v1",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/v1",
    "https://198.18.0.1/v1",
    "https://224.0.0.1/v1",
    "https://2130706433/v1", // decimal form of 127.0.0.1
    "https://0x7f.1/v1", // hex/short form of 127.0.0.1
    "https://017700000001/v1", // octal form of 127.0.0.1
    "https://[::1]/v1",
    "https://[::]/v1",
    "https://[::ffff:127.0.0.1]/v1",
    "https://[::ffff:10.0.0.1]/v1",
    "https://[fe80::1]/v1",
    "https://[fd00::1]/v1",
    "https://[fc00::1]/v1",
    "https://[2001:db8::1]/v1",
  ])("rejects internal target %s", (raw) => {
    const result = ok(raw);
    expect(result.ok).toBe(false);
  });

  it("explains why", () => {
    const result = ok("https://169.254.169.254/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/private|internal/i);
  });
});

describe("provider base URL policy (loose, for local development and self-hosting)", () => {
  it("allows http and private hosts, e.g. a local Ollama", () => {
    expect(ok("http://localhost:11434/v1", LOOSE)).toEqual({ ok: true, url: "http://localhost:11434/v1" });
    expect(ok("http://192.168.1.20:11434/v1", LOOSE)).toMatchObject({ ok: true });
  });

  it("still refuses other schemes, embedded credentials, and query/fragment tricks", () => {
    expect(ok("file:///etc/passwd", LOOSE).ok).toBe(false);
    expect(ok("http://user:pass@localhost/v1", LOOSE).ok).toBe(false);
    expect(ok("http://localhost/v1?x=", LOOSE).ok).toBe(false);
  });
});

describe("defaultUrlPolicy", () => {
  it("is strict in production unless explicitly relaxed", () => {
    expect(defaultUrlPolicy({ NODE_ENV: "production" })).toEqual({ allowPrivate: false });
    expect(defaultUrlPolicy({ NODE_ENV: "production", GENIFY_ALLOW_PRIVATE_AI_HOSTS: "true" })).toEqual({ allowPrivate: true });
    expect(defaultUrlPolicy({ NODE_ENV: "production", GENIFY_ALLOW_PRIVATE_AI_HOSTS: "yes" })).toEqual({ allowPrivate: false });
  });
  it("is relaxed outside production so local development keeps working", () => {
    expect(defaultUrlPolicy({ NODE_ENV: "development" })).toEqual({ allowPrivate: true });
    expect(defaultUrlPolicy({})).toEqual({ allowPrivate: true });
  });
});

describe("resolveProviderUrl (what the adapters call right before fetch)", () => {
  it("joins the endpoint path onto a validated base URL", async () => {
    const lookup = vi.fn().mockResolvedValue(["93.184.216.34"]);
    expect(await resolveProviderUrl("https://api.example.com/v1/", "/chat/completions", { policy: STRICT, lookup })).toBe(
      "https://api.example.com/v1/chat/completions"
    );
  });

  it("refuses an unsafe base URL with UnsafeProviderUrlError", async () => {
    const lookup = vi.fn();
    await expect(resolveProviderUrl("http://169.254.169.254/", "/v1/messages", { policy: STRICT, lookup })).rejects.toBeInstanceOf(UnsafeProviderUrlError);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a public-looking hostname that RESOLVES to a private address (DNS pointing inward)", async () => {
    const lookup = vi.fn().mockResolvedValue(["93.184.216.34", "10.0.0.7"]);
    await expect(resolveProviderUrl("https://innocent.example.com/v1", "/chat/completions", { policy: STRICT, lookup })).rejects.toBeInstanceOf(
      UnsafeProviderUrlError
    );
  });

  it("does not resolve names at all when private hosts are allowed", async () => {
    const lookup = vi.fn();
    expect(await resolveProviderUrl("http://localhost:11434/v1", "/chat/completions", { policy: LOOSE, lookup })).toBe(
      "http://localhost:11434/v1/chat/completions"
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it("lets the request go (and fail normally) when the name simply doesn't resolve", async () => {
    const lookup = vi.fn().mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
    expect(await resolveProviderUrl("https://nope.example.com/v1", "/chat/completions", { policy: STRICT, lookup })).toBe(
      "https://nope.example.com/v1/chat/completions"
    );
  });
});
