import { describe, expect, it } from "vitest";
import { estimatePasswordStrength, generatePassword, type PasswordOptions } from "./password";

const ALL: PasswordOptions = { length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true };

describe("password generator", () => {
  it("honours the requested length", () => {
    for (const length of [8, 16, 33, 64]) expect(generatePassword({ ...ALL, length })).toHaveLength(length);
  });

  it("clamps length into 4..128", () => {
    expect(generatePassword({ ...ALL, length: 1 })).toHaveLength(4);
    expect(generatePassword({ ...ALL, length: 9999 })).toHaveLength(128);
  });

  it("always includes at least one character from every selected set", () => {
    for (let i = 0; i < 300; i++) {
      const pw = generatePassword({ ...ALL, length: 8 });
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("only uses selected sets", () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassword({ ...ALL, uppercase: false, lowercase: false, symbols: false })).toMatch(/^[0-9]+$/);
      expect(generatePassword({ ...ALL, numbers: false, symbols: false, uppercase: false })).toMatch(/^[a-z]+$/);
    }
  });

  it("avoids visually ambiguous characters (I, O, l, 0, 1)", () => {
    for (let i = 0; i < 300; i++) expect(generatePassword({ ...ALL, length: 64 })).not.toMatch(/[IOl01]/);
  });

  it("returns an empty string when nothing is selected", () => {
    expect(generatePassword({ length: 16, uppercase: false, lowercase: false, numbers: false, symbols: false })).toBe("");
  });

  it("is not constant", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePassword(ALL)));
    expect(set.size).toBe(50);
  });
});

describe("password strength estimate", () => {
  it("rates by entropy bands", () => {
    expect(estimatePasswordStrength("")).toEqual({ bits: 0, label: "Weak" });
    expect(estimatePasswordStrength("aaaaaaaa").label).toBe("Weak"); // 26^8 ~ 37.6 bits
    expect(estimatePasswordStrength("abcde12345").label).toBe("Fair"); // 36^10 ~ 51.7 bits
    expect(estimatePasswordStrength("Abcdefgh12!@").label).toBe("Strong"); // 94^12 ~ 78.7 bits
    expect(estimatePasswordStrength("Abcdefghij12345678!@").label).toBe("Very strong"); // 94^20 ~ 131 bits
  });

  it("grows with length", () => {
    expect(estimatePasswordStrength("abcdefghijkl").bits).toBeGreaterThan(estimatePasswordStrength("abcdefgh").bits);
  });
});
