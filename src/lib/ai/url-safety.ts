/**
 * Guards the one place where the server makes a request to an address a USER chose: the base URL of a
 * saved AI provider ("bring your own key", Ollama, custom OpenAI-compatible endpoints).
 *
 * Without this, any signed-in user could point that URL at an internal service (localhost, a private
 * network, a cloud metadata endpoint) and have the server call it for them - server-side request forgery.
 *
 * Strict policy (production): https only, no internal/private/loopback/link-local addresses or names, no
 * credentials/query/fragment in the URL. Loose policy (local development, or GENIFY_ALLOW_PRIVATE_AI_HOSTS=true
 * for self-hosters who really do run Ollama next to the app): http and private hosts allowed.
 *
 * This file deliberately imports nothing from the app, so it is easy to test in isolation.
 */

export interface UrlPolicy {
  allowPrivate: boolean;
}

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export class UnsafeProviderUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeProviderUrlError";
  }
}

type Env = Record<string, string | undefined>;

export function defaultUrlPolicy(env: Env = process.env): UrlPolicy {
  return { allowPrivate: env.GENIFY_ALLOW_PRIVATE_AI_HOSTS === "true" || env.NODE_ENV !== "production" };
}

const PRIVATE_NAME_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".lan", ".home.arpa", ".intranet", ".corp"];

function ipv4Octets(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((n) => n <= 255) ? octets : null;
}

function isPrivateIpv4(o: number[]): boolean {
  const [a, b, c] = o;
  return (
    a === 0 || // "this network" (0.0.0.0 reaches localhost on many systems)
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function parseIpv6Groups(host: string): number[] | null {
  // `host` has no brackets. Expand "::" and an embedded dotted IPv4 tail.
  let h = host.toLowerCase();
  const zone = h.indexOf("%");
  if (zone !== -1) h = h.slice(0, zone);
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (v4) {
    const o = ipv4Octets(v4[1]);
    if (!o) return null;
    h = h.slice(0, -v4[1].length) + ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isPrivateIpv6(host: string): boolean {
  const g = parseIpv6Groups(host);
  if (!g) return true; // can't understand it -> don't trust it
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible: judge the embedded IPv4 address.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return isPrivateIpv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
  }
  // Only global unicast (2000::/3) is public, minus documentation, 6to4 and Teredo ranges.
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return true;
  if (g[0] === 0x2002) return true;
  return false;
}

/** True for any address a user-supplied URL must not be allowed to reach. Accepts IPv4 or IPv6 text. */
export function isPrivateAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const v4 = ipv4Octets(bare);
  if (v4) return isPrivateIpv4(v4);
  if (bare.includes(":")) return isPrivateIpv6(bare);
  return false;
}

export function checkProviderBaseUrl(raw: string, policy: UrlPolicy = defaultUrlPolicy()): UrlCheck {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, reason: "The base URL is empty." };
  // A "?" or "#" would let someone turn the path we append (e.g. /chat/completions) into a query string.
  if (text.includes("?") || text.includes("#")) return { ok: false, reason: "The base URL can't contain a query string or fragment." };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: "That isn't a valid URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Only http(s) URLs are allowed." };
  if (url.username || url.password) return { ok: false, reason: "The base URL can't contain a username or password." };

  if (!policy.allowPrivate) {
    if (url.protocol !== "https:") return { ok: false, reason: "The base URL must use https." };

    // WHATWG URL parsing has already normalised 2130706433, 0x7f.1, 017700000001 etc. to dotted form.
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const bare = host.replace(/^\[|\]$/g, "");
    const isIp = Boolean(ipv4Octets(bare)) || bare.includes(":");

    if (isIp) {
      if (isPrivateAddress(bare)) return { ok: false, reason: "That address is private or internal." };
    } else {
      if (host === "localhost" || PRIVATE_NAME_SUFFIXES.some((s) => host.endsWith(s))) {
        return { ok: false, reason: "That hostname is private or internal." };
      }
      if (!host.includes(".")) return { ok: false, reason: "That hostname is private or internal (no domain)." };
    }
  }

  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${url.protocol}//${url.host}${path}` };
}

export interface ResolveOptions {
  policy?: UrlPolicy;
  /** Resolves a hostname to its IP addresses. Injected in tests; defaults to the system resolver. */
  lookup?: (hostname: string) => Promise<string[]>;
}

async function systemLookup(hostname: string): Promise<string[] | null> {
  try {
    // Not available on every runtime (e.g. browsers); where it isn't, there's no private network to protect either.
    const dns = await import("node:dns/promises");
    const results = await dns.lookup(hostname, { all: true });
    return results.map((r) => r.address);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") return []; // fetch will fail on its own
    return null;
  }
}

/**
 * Validates `baseUrl`, checks that its hostname doesn't RESOLVE to an internal address (a public-looking
 * name pointed at 10.x.x.x), and returns the full URL to fetch (`baseUrl` + `path`). Call it right before fetch.
 * (A name that changes its answer between this lookup and the fetch - DNS rebinding - is narrowed, not
 * eliminated, by this; pair it with `redirect: "error"` and network-level egress rules where you can.)
 */
export async function resolveProviderUrl(baseUrl: string, path: string, options: ResolveOptions = {}): Promise<string> {
  const policy = options.policy ?? defaultUrlPolicy();
  const checked = checkProviderBaseUrl(baseUrl, policy);
  if (!checked.ok) throw new UnsafeProviderUrlError(`AI provider base URL not allowed: ${checked.reason}`);

  if (!policy.allowPrivate) {
    const host = new URL(checked.url).hostname.replace(/^\[|\]$/g, "");
    const isIp = Boolean(ipv4Octets(host)) || host.includes(":");
    if (!isIp) {
      const lookup = options.lookup ?? systemLookup;
      const addresses = await lookup(host).catch(() => null);
      if (addresses && addresses.some(isPrivateAddress)) {
        throw new UnsafeProviderUrlError("AI provider base URL not allowed: that hostname resolves to a private or internal address.");
      }
    }
  }
  return `${checked.url}${path}`;
}
