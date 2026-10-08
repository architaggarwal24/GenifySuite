/**
 * JWT sessions can't be revoked on their own, so User.sessionsValidAfter acts as a cut-off: any session
 * issued before it is dead. Set on password change/reset and on "sign out everywhere".
 *
 * Compared in whole seconds (a JWT's `iat` has second precision). A strict ">" on the floored cutoff
 * means someone who signs back in within the same second as the password change keeps their new session,
 * instead of being immediately logged out by sub-second rounding.
 */
export function isSessionStale(tokenIssuedAtSeconds: number | undefined, sessionsValidAfter: Date | null | undefined): boolean {
  if (!sessionsValidAfter) return false;
  if (typeof tokenIssuedAtSeconds !== "number") return true; // can't prove it's newer than the cutoff
  return Math.floor(sessionsValidAfter.getTime() / 1000) > tokenIssuedAtSeconds;
}
