export type HeaderGetter = (name: string) => string | null | undefined;

/**
 * Best-effort client IP for rate limiting. On Vercel the platform sets these headers itself (a client
 * can't forge x-vercel-forwarded-for there). If you self-host WITHOUT a trusted proxy in front, a client
 * can spoof x-forwarded-for to dodge the per-IP limits - the per-account limits still hold.
 * Returns null when no address is available, so callers skip the IP limit rather than lumping every
 * unknown visitor into one shared bucket.
 */
export function getClientIp(get: HeaderGetter): string | null {
  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
    const first = get(name)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return null;
}

export const ipFromRequest = (request: Request): string | null => getClientIp((name) => request.headers.get(name));
