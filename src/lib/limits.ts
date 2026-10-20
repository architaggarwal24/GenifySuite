/** Size limits for data users can store. */
export const HISTORY_LIMITS = {
  /** Saved items per user. */
  maxItems: 1_000,
  /** Serialized size of one saved item's payload. */
  maxPayloadChars: 50_000,
} as const;

/** Serialized JSON size of a value, or null if it can't be stored as JSON (undefined, circular, ...). */
export function jsonChars(value: unknown): number | null {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : text.length;
  } catch {
    return null;
  }
}
