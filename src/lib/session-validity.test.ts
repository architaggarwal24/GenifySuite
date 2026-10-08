import { describe, expect, it } from "vitest";
import { isSessionStale } from "./session-validity";

const at = (iso: string) => new Date(iso);
const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("session cut-off", () => {
  it("never invalidates anything when no cut-off has been set", () => {
    expect(isSessionStale(sec("2020-01-01T00:00:00Z"), null)).toBe(false);
    expect(isSessionStale(undefined, null)).toBe(false);
    expect(isSessionStale(undefined, undefined)).toBe(false);
  });

  it("invalidates sessions issued before the cut-off", () => {
    expect(isSessionStale(sec("2026-09-30T12:00:00Z"), at("2026-09-30T12:05:00Z"))).toBe(true);
    expect(isSessionStale(sec("2026-09-30T12:04:59Z"), at("2026-09-30T12:05:00Z"))).toBe(true);
  });

  it("keeps sessions issued after the cut-off", () => {
    expect(isSessionStale(sec("2026-09-30T12:05:01Z"), at("2026-09-30T12:05:00Z"))).toBe(false);
    expect(isSessionStale(sec("2026-10-01T00:00:00Z"), at("2026-09-30T12:05:00Z"))).toBe(false);
  });

  it("keeps a session created in the SAME second as the change (sub-second rounding must not log people out)", () => {
    // Password changed at 12:05:00.900; the user signs straight back in at 12:05:00.950 -> iat 12:05:00.
    expect(isSessionStale(sec("2026-09-30T12:05:00Z"), at("2026-09-30T12:05:00.900Z"))).toBe(false);
  });

  it("treats a token with no issue time as stale once a cut-off exists", () => {
    expect(isSessionStale(undefined, at("2026-09-30T12:05:00Z"))).toBe(true);
  });
});
