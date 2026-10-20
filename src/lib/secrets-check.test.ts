import { describe, expect, it } from "vitest";
import { assertProductionSecrets, findWeakSecrets } from "./secrets-check";

const STRONG = "k3Jx9Vb2Qm7Zt1Lw8Nc4Rf6Hy0Gd5Sa3Pu2Eo1Ti9Wq=";

describe("findWeakSecrets", () => {
  it("flags the placeholder shipped in .env.example, short values and a missing NEXTAUTH_SECRET", () => {
    expect(findWeakSecrets({ NEXTAUTH_SECRET: "replace-with-a-random-32-byte-secret" })).toContain("NEXTAUTH_SECRET");
    expect(findWeakSecrets({ NEXTAUTH_SECRET: "abc123" })).toContain("NEXTAUTH_SECRET");
    expect(findWeakSecrets({})).toContain("NEXTAUTH_SECRET");
    expect(findWeakSecrets({ NEXTAUTH_SECRET: "   " })).toContain("NEXTAUTH_SECRET");
  });
  it("accepts a long random secret", () => {
    expect(findWeakSecrets({ NEXTAUTH_SECRET: STRONG })).toEqual([]);
  });
  it("checks ENCRYPTION_KEY only when it is set (a blank one fails loudly elsewhere)", () => {
    expect(findWeakSecrets({ NEXTAUTH_SECRET: STRONG, ENCRYPTION_KEY: "" })).toEqual([]);
    expect(findWeakSecrets({ NEXTAUTH_SECRET: STRONG, ENCRYPTION_KEY: "short" })).toEqual(["ENCRYPTION_KEY"]);
    expect(findWeakSecrets({ NEXTAUTH_SECRET: STRONG, ENCRYPTION_KEY: STRONG })).toEqual([]);
  });
});

describe("assertProductionSecrets", () => {
  it("throws in production and names the variable, never its value", () => {
    const env = { NODE_ENV: "production", NEXTAUTH_SECRET: "replace-with-a-random-32-byte-secret" };
    expect(() => assertProductionSecrets(env)).toThrow(/NEXTAUTH_SECRET/);
    try {
      assertProductionSecrets(env);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("replace-with");
    }
  });
  it("does nothing outside production, so local development and tests are unaffected", () => {
    expect(() => assertProductionSecrets({ NODE_ENV: "development", NEXTAUTH_SECRET: "x" })).not.toThrow();
    expect(() => assertProductionSecrets({})).not.toThrow();
  });
  it("passes with good secrets in production", () => {
    expect(() => assertProductionSecrets({ NODE_ENV: "production", NEXTAUTH_SECRET: STRONG, ENCRYPTION_KEY: STRONG })).not.toThrow();
  });
});
