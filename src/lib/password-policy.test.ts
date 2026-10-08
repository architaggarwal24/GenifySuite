import { describe, expect, it } from "vitest";
import { MAX_PASSWORD_BYTES, validatePassword } from "./password-policy";

describe("password policy", () => {
  it.each(["correct horse battery", "Tr0ub4dor&3x", "a-fairly-long-passphrase", "12345678a!", "ünïcödé-påssword"])("accepts %s", (pw) => {
    expect(validatePassword(pw)).toBeNull();
  });

  it("requires at least 8 characters", () => {
    expect(validatePassword("")).toMatch(/at least 8/);
    expect(validatePassword("abc1234")).toMatch(/at least 8/);
    expect(validatePassword("kx93hq27")).toBeNull();
  });

  it("rejects passwords bcrypt would silently truncate (over 72 bytes)", () => {
    expect(validatePassword("a1".repeat(36))).toBeNull(); // exactly 72 bytes
    expect(validatePassword("a1".repeat(36) + "x")).toMatch(/too long/);
  });

  it("counts BYTES, not characters, for the 72 limit", () => {
    const ascii = "a1".repeat(MAX_PASSWORD_BYTES / 2);
    const emoji = "😀".repeat(19); // 19 characters but 76 bytes
    expect(emoji.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(validatePassword(ascii + "")).toBeNull();
    expect(validatePassword(emoji)).toMatch(/too long/);
  });

  it.each(["password", "Password123", "PASSWORD1", "12345678", "qwertyuiop", "iloveyou", "GenifySuite123"])("rejects the common password %s", (pw) => {
    expect(validatePassword(pw)).toMatch(/too common/);
  });

  it("rejects a single repeated character", () => {
    expect(validatePassword("zzzzzzzzzz")).toMatch(/repeated/);
  });

  it("rejects passwords containing the email's local part, or the whole email", () => {
    const ctx = { email: "archit.sharma@example.com" };
    expect(validatePassword("ilove-archit.sharma-2026", ctx)).toMatch(/email/);
    expect(validatePassword("archit.sharma@example.com", ctx)).toMatch(/email/);
    expect(validatePassword("an-unrelated-passphrase", ctx)).toBeNull();
  });

  it("ignores very short email local parts (they'd match innocent passwords by chance)", () => {
    expect(validatePassword("pa-xyz-password-1", { email: "pa@example.com" })).toBeNull();
  });
});
