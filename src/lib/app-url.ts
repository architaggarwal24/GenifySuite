/**
 * The public base URL used in links we email out. Taken from configuration, never from the incoming
 * request's Host header in production: otherwise an attacker could trigger a reset for someone else
 * while sending `Host: evil.example`, and the victim would receive a genuine email linking to the
 * attacker's site (password reset poisoning).
 */
export function getAppUrl(request?: Request): string | null {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  if (process.env.NODE_ENV !== "production" && request) return new URL(request.url).origin;
  return null;
}
