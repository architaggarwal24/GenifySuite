export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hslToHex({ h, s, l }: HSL): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

export function hexToHsl(hex: string): HSL | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export type HarmonyType = "complementary" | "analogous" | "triadic" | "monochrome" | "split-complementary";

export interface PaletteSwatch {
  hex: string;
  hsl: HSL;
}

export function generatePalette(baseHex: string, harmony: HarmonyType): PaletteSwatch[] {
  const base = hexToHsl(baseHex) ?? { h: Math.floor(Math.random() * 360), s: 65, l: 55 };

  const hueOffsets: Record<HarmonyType, number[]> = {
    complementary: [0, 180],
    analogous: [0, 30, -30, 60, -60],
    triadic: [0, 120, 240],
    "split-complementary": [0, 150, 210],
    monochrome: [0, 0, 0, 0, 0],
  };

  const offsets = hueOffsets[harmony];

  return offsets.map((offset, i) => {
    let h = (base.h + offset + 360) % 360;
    let s = base.s;
    let l = base.l;

    if (harmony === "monochrome") {
      l = Math.max(12, Math.min(92, base.l + (i - 2) * 18));
    }

    s = Math.max(20, Math.min(90, s));
    l = Math.max(15, Math.min(88, l));

    const hsl = { h, s, l };
    return { hex: hslToHex(hsl), hsl };
  });
}

export function randomBaseColor(): string {
  return hslToHex({ h: Math.floor(Math.random() * 360), s: 55 + Math.random() * 30, l: 45 + Math.random() * 15 });
}
