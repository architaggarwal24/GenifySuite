import { describe, expect, it } from "vitest";
import { ALL_NETWORKS, detectNetwork, formatCardNumber, generateTestCard, isLuhnValid, luhnCheckDigit } from "./cards";

describe("cards: Luhn", () => {
  // Well-known public test numbers published by the card networks / payment processors.
  it.each([
    ["4242424242424242", "Visa"],
    ["4111111111111111", "Visa"],
    ["5555555555554444", "Mastercard"],
    ["378282246310005", "American Express"],
    ["6011111111111117", "Discover"],
    ["30569309025904", "Diners Club"],
  ])("accepts %s and identifies %s", (number, network) => {
    expect(isLuhnValid(number)).toBe(true);
    expect(detectNetwork(number)).toBe(network);
  });

  it("rejects a number with one wrong digit", () => {
    expect(isLuhnValid("4242424242424241")).toBe(false);
    expect(isLuhnValid("4242424242424243")).toBe(false);
  });

  it("catches every single-digit typo in a valid number", () => {
    const valid = "4242424242424242";
    for (let i = 0; i < valid.length; i++) {
      for (const d of "0123456789") {
        if (d === valid[i]) continue;
        const typo = valid.slice(0, i) + d + valid.slice(i + 1);
        expect(isLuhnValid(typo), `typo at ${i} -> ${d}`).toBe(false);
      }
    }
  });

  it("ignores spaces and dashes", () => {
    expect(isLuhnValid("4242 4242 4242 4242")).toBe(true);
    expect(isLuhnValid("4242-4242-4242-4242")).toBe(true);
  });

  it("rejects numbers that are too short", () => {
    expect(isLuhnValid("")).toBe(false);
    expect(isLuhnValid("0000000")).toBe(false);
  });

  it("computes the check digit that completes a number", () => {
    expect(luhnCheckDigit("424242424242424")).toBe(2);
    expect(luhnCheckDigit("37828224631000")).toBe(5);
  });

  it("returns Unknown for unrecognised prefixes", () => {
    expect(detectNetwork("9999999999999995")).toBe("Unknown");
    expect(detectNetwork("")).toBe("Unknown");
  });

  it("formats digits in groups of four", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
  });
});

describe("cards: test card generator", () => {
  const expectedLength: Record<string, number> = {
    Visa: 16,
    Mastercard: 16,
    "American Express": 15,
    Discover: 16,
    "Diners Club": 14,
  };

  it.each(ALL_NETWORKS)("%s: every generated number is Luhn-valid, the right length, and detected as that network", (network) => {
    for (let i = 0; i < 300; i++) {
      const card = generateTestCard(network);
      const digits = card.number.replace(/\s/g, "");
      expect(digits).toHaveLength(expectedLength[network]);
      expect(isLuhnValid(digits)).toBe(true);
      expect(detectNetwork(digits)).toBe(network);
      expect(card.network).toBe(network);
    }
  });

  it("produces a valid future-looking expiry and a CVV of the right length", () => {
    const thisYear = new Date().getFullYear() % 100;
    for (const network of ALL_NETWORKS) {
      for (let i = 0; i < 100; i++) {
        const card = generateTestCard(network);
        expect(Number(card.expMonth)).toBeGreaterThanOrEqual(1);
        expect(Number(card.expMonth)).toBeLessThanOrEqual(12);
        expect(card.expMonth).toHaveLength(2);
        expect(Number(card.expYear)).toBeGreaterThan(thisYear);
        expect(card.cvv).toHaveLength(network === "American Express" ? 4 : 3);
      }
    }
  });

  it("does not generate the same number twice in a row (it is random)", () => {
    const numbers = new Set(Array.from({ length: 50 }, () => generateTestCard("Visa").number));
    expect(numbers.size).toBeGreaterThan(45);
  });
});
