import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

beforeEach(() => vi.stubEnv("ENCRYPTION_KEY", "a-long-random-test-secret-value"));
afterEach(() => vi.unstubAllEnvs());

describe("secret encryption", () => {
  it("round-trips, including unicode", () => {
    for (const text of ["sk-ant-api03-abc123", "", "ключ-🔑-鍵", "x".repeat(2000)]) {
      expect(decryptSecret(encryptSecret(text))).toBe(text);
    }
  });

  it("never stores the plaintext", () => {
    expect(encryptSecret("sk-super-secret")).not.toContain("sk-super-secret");
  });

  it("uses a fresh random IV, so the same input encrypts differently each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("detects tampering with the ciphertext", () => {
    const [iv, tag, data] = encryptSecret("sk-secret").split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("detects tampering with the auth tag", () => {
    const [iv, tag, data] = encryptSecret("sk-secret").split(".");
    const badTag = Buffer.from(tag, "base64");
    badTag[0] ^= 0xff;
    expect(() => decryptSecret([iv, badTag.toString("base64"), data].join("."))).toThrow();
  });

  it("cannot be decrypted with a different key", () => {
    const encrypted = encryptSecret("sk-secret");
    vi.stubEnv("ENCRYPTION_KEY", "a-completely-different-secret");
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("not-a-payload")).toThrow(/Malformed/);
    expect(() => decryptSecret("a.b")).toThrow(/Malformed/);
  });

  it("fails loudly when ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("masks all but the last four characters", () => {
    expect(maskSecret("sk-ant-1234567890abcd")).toBe("••••abcd");
    expect(maskSecret("abc")).toBe("••••");
  });
});
