/**
 * Validates a post-login redirect target taken from the URL. Only same-site relative paths are
 * allowed; anything else falls back to a safe default. Without this, `/login?callbackUrl=https://evil.example`
 * becomes an open redirect that sends people off-site right after they authenticate.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (raw.length > 500) return fallback;
  // Must be a path on this site. "//host" and "/\host" are protocol-relative forms browsers treat as external.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Browsers strip tabs/newlines inside URLs, so "/\t/evil.com" would become "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
