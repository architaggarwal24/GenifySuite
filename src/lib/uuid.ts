export function generateUuidV4(): string {
  return crypto.randomUUID();
}

/** UUID v1-shaped identifier: time-based bits, but not spec-compliant clock-seq/node -
 *  useful for generating visually "v1-style" test fixtures without a real MAC address. */
export function generateTimeOrderedId(): string {
  const timestamp = Date.now().toString(16).padStart(12, "0");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const hex = (timestamp + random).slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "1" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";
