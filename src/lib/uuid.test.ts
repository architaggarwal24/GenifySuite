import { afterEach, describe, expect, it, vi } from "vitest";
import { NIL_UUID, generateTimeOrderedId, generateUuidV4 } from "./uuid";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

afterEach(() => vi.useRealTimers());

describe("uuid", () => {
  it("v4 has the right shape, version and variant", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateUuidV4();
      expect(id).toMatch(UUID_SHAPE);
      expect(id[14]).toBe("4");
      expect("89ab").toContain(id[19]);
    }
  });

  it("v4 values are unique", () => {
    expect(new Set(Array.from({ length: 1000 }, generateUuidV4)).size).toBe(1000);
  });

  it("time-ordered ids have a UUID shape with version 1 and variant 8", () => {
    for (let i = 0; i < 100; i++) {
      const id = generateTimeOrderedId();
      expect(id).toMatch(UUID_SHAPE);
      expect(id[14]).toBe("1");
      expect(id[19]).toBe("8");
    }
  });

  it("time-ordered ids sort in creation order when created in different milliseconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00.000Z"));
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push(generateTimeOrderedId());
      vi.advanceTimersByTime(1 + (i % 4));
    }
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("NIL_UUID is all zeros", () => {
    expect(NIL_UUID).toBe("00000000-0000-0000-0000-000000000000");
    expect(NIL_UUID).toMatch(UUID_SHAPE);
  });
});
