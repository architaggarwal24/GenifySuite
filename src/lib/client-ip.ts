export type HeaderGetter = (name: string) => string | null | undefined;
type Env = Record<string, string | undefined>;

const MAX_LENGTH = 64;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_LENGTH) : null;
};
const entries = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Best-effort client IP for rate limiting. Whose word to take depends on what sits in front of the app,
 * because most of these headers are just text a client can send itself:
 *
 *  - GENIFY_TRUSTED_IP_HEADER names the one header YOUR edge sets or overwrites (e.g. `cf-connecting-ip`
 *    on Cloudflare). Nothing else is believed. For `x-forwarded-for`, GENIFY_TRUSTED_PROXY_HOPS (default 1)
 *    says how many of your own proxies append to it, and the entry they added is used - never the
 *    client-supplied first one.
 *  - On Vercel the platform overwrites x-vercel-forwarded-for itself, so that is trusted.
 *  - In development/tests, the first x-vercel-forwarded-for / x-forwarded-for / x-real-ip is used.
 *  - Otherwise (production, nothing configured) the LAST x-forwarded-for entry is used - the address your
 *    nearest proxy saw - and x-vercel-forwarded-for is ignored, since nothing guarantees it was not forged.
 *
 * Returns null when no trustworthy address is available, so callers skip the IP limit rather than lumping
 * every unknown visitor into one shared bucket (the per-account limits still apply).
 */
export function getClientIp(get: HeaderGetter, env: Env = process.env): string | null {
  const configured = env.GENIFY_TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (configured) {
    const raw = get(configured);
    if (!raw) return null;
    if (configured === "x-forwarded-for") {
      const hops = Math.max(1, parseInt(env.GENIFY_TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
      const list = entries(raw);
      return clean(list[list.length - hops]);
    }
    return clean(raw.split(",")[0]);
  }

  if (env.VERCEL || env.NODE_ENV !== "production") {
    for (const name of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
      const first = clean(get(name)?.split(",")[0]);
      if (first) return first;
    }
    return null;
  }

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const list = entries(forwarded);
    const last = clean(list[list.length - 1]);
    if (last) return last;
  }
  return clean(get("x-real-ip")?.split(",")[0]);
}

export const ipFromRequest = (request: Request): string | null => getClientIp((name) => request.headers.get(name));
