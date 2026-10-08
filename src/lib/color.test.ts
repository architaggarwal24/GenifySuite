import { describe, expect, it } from "vitest";
import { generatePalette, hexToHsl, hslToHex, randomBaseColor, type HarmonyType } from "./color";

const HEX = /^#[0-9a-f]{6}$/;

describe("color conversion", () => {
  it.each([
    ["#ff0000", { h: 0, s: 100, l: 50 }],
    ["#00ff00", { h: 120, s: 100, l: 50 }],
    ["#0000ff", { h: 240, s: 100, l: 50 }],
    ["#ffffff", { h: 0, s: 0, l: 100 }],
    ["#000000", { h: 0, s: 0, l: 0 }],
  ])("hexToHsl(%s)", (hex, hsl) => {
    expect(hexToHsl(hex)).toEqual(hsl);
  });

  it.each([
    [{ h: 0, s: 100, l: 50 }, "#ff0000"],
    [{ h: 120, s: 100, l: 50 }, "#00ff00"],
    [{ h: 240, s: 100, l: 50 }, "#0000ff"],
    [{ h: 0, s: 0, l: 100 }, "#ffffff"],
    [{ h: 0, s: 0, l: 0 }, "#000000"],
  ])("hslToHex(%j)", (hsl, hex) => {
    expect(hslToHex(hsl)).toBe(hex);
  });

  it("accepts hex with or without '#', any case", () => {
    expect(hexToHsl("FF0000")).toEqual({ h: 0, s: 100, l: 50 });
  });

  it("rejects invalid hex", () => {
    for (const bad of ["", "#fff", "#12345", "#gggggg", "red", "#1234567"]) expect(hexToHsl(bad)).toBeNull();
  });

  it("round-trips within rounding error", () => {
    for (let i = 0; i < 200; i++) {
      const original = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
      const back = hslToHex(hexToHsl(original)!);
      for (const c of [1, 3, 5]) {
        const a = parseInt(original.slice(c, c + 2), 16);
        const b = parseInt(back.slice(c, c + 2), 16);
        expect(Math.abs(a - b), `${original} -> ${back}`).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("palettes", () => {
  const sizes: Record<HarmonyType, number> = {
    complementary: 2,
    analogous: 5,
    triadic: 3,
    "split-complementary": 3,
    monochrome: 5,
  };

  it.each(Object.entries(sizes))("%s has %i valid colors", (harmony, size) => {
    const palette = generatePalette("#e8a33d", harmony as HarmonyType);
    expect(palette).toHaveLength(size);
    for (const swatch of palette) expect(swatch.hex).toMatch(HEX);
  });

  it("complementary is 180 degrees away, triadic 120 apart", () => {
    const base = hexToHsl("#3366cc")!;
    const comp = generatePalette("#3366cc", "complementary");
    expect(comp[0].hsl.h).toBe(base.h);
    expect(comp[1].hsl.h).toBe((base.h + 180) % 360);
    const tri = generatePalette("#3366cc", "triadic");
    expect(tri.map((s) => s.hsl.h)).toEqual([base.h, (base.h + 120) % 360, (base.h + 240) % 360]);
  });

  it("monochrome keeps the hue and steps lightness upward", () => {
    const mono = generatePalette("#3366cc", "monochrome");
    const hue = mono[0].hsl.h;
    mono.forEach((s) => expect(s.hsl.h).toBe(hue));
    for (let i = 1; i < mono.length; i++) expect(mono[i].hsl.l).toBeGreaterThanOrEqual(mono[i - 1].hsl.l);
  });

  it("still returns a palette when the base color is invalid", () => {
    const palette = generatePalette("not-a-color", "analogous");
    expect(palette).toHaveLength(5);
    palette.forEach((s) => expect(s.hex).toMatch(HEX));
  });

  it("random base colors are valid hex", () => {
    for (let i = 0; i < 50; i++) expect(randomBaseColor()).toMatch(HEX);
  });
});
