import { describe, expect, it } from "vitest";
import { HISTORY_LIMITS, jsonChars } from "./limits";

describe("jsonChars", () => {
  it("measures the serialized size of a value", () => {
    expect(jsonChars({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    expect(jsonChars("hello")).toBe(7);
    expect(jsonChars(null)).toBe(4);
  });
  it("returns null for something that can't be stored as JSON", () => {
    expect(jsonChars(undefined)).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(jsonChars(circular)).toBeNull();
  });
  it("history limits are sane", () => {
    expect(HISTORY_LIMITS.maxPayloadChars).toBeGreaterThan(1000);
    expect(HISTORY_LIMITS.maxItems).toBeGreaterThan(50);
  });
});
