import { describe, expect, it } from "vitest";
import { generateLorem } from "./lorem";

describe("lorem ipsum", () => {
  it("returns exactly N words", () => {
    for (const n of [1, 5, 6, 12, 50]) {
      expect(generateLorem("words", n, false).replace(/\.$/, "").split(" ")).toHaveLength(n);
      expect(generateLorem("words", n, true).replace(/\.$/, "").split(" ")).toHaveLength(n);
    }
  });

  it("starts with the classic opening when asked", () => {
    expect(generateLorem("words", 8, true)).toMatch(/^Lorem ipsum dolor sit amet, /);
    expect(generateLorem("sentences", 3, true)).toMatch(/^Lorem ipsum dolor sit amet, consectetur adipiscing elit\./);
    expect(generateLorem("paragraphs", 2, true)).toMatch(/^Lorem ipsum dolor sit amet, consectetur adipiscing elit\./);
  });

  it("never ends a sentence with a stray comma before the period", () => {
    // Exactly five classic words used to render as "Lorem ipsum dolor sit amet,."
    expect(generateLorem("words", 5, true)).toBe("Lorem ipsum dolor sit amet.");
    for (let i = 0; i < 100; i++) expect(generateLorem("words", 5 + (i % 3), true)).not.toMatch(/,\.$/);
  });

  it("returns exactly N sentences, each capitalised and ending with a period", () => {
    const text = generateLorem("sentences", 6, false);
    const sentences = text.split(/(?<=\.) /);
    expect(sentences).toHaveLength(6);
    for (const s of sentences) {
      expect(s).toMatch(/^[A-Z]/);
      expect(s).toMatch(/\.$/);
    }
  });

  it("returns exactly N paragraphs separated by blank lines", () => {
    expect(generateLorem("paragraphs", 4, false).split("\n\n")).toHaveLength(4);
  });

  it("clamps absurd counts to a sane maximum and minimum", () => {
    expect(generateLorem("words", 100000, false).split(" ").length).toBeLessThanOrEqual(500);
    expect(generateLorem("paragraphs", 100000, false).split("\n\n").length).toBeLessThanOrEqual(20);
    expect(generateLorem("words", 0, false).length).toBeGreaterThan(0);
    expect(generateLorem("words", -5, false).length).toBeGreaterThan(0);
  });

  it("only uses latin filler words", () => {
    const text = generateLorem("paragraphs", 3, true).toLowerCase().replace(/[.,\n]/g, " ");
    for (const word of text.split(/\s+/).filter(Boolean)) expect(word).toMatch(/^[a-z]+$/);
  });
});
