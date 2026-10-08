import { describe, expect, it } from "vitest";
import { generateFakeProfile } from "./profile";

// RFC 2606 reserves these so test data can never be delivered to a real mailbox.
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net"];

describe("fake profile generator", () => {
  const sample = Array.from({ length: 300 }, generateFakeProfile);

  it("fills every field", () => {
    for (const p of sample) for (const [key, value] of Object.entries(p)) expect(value, key).toBeTruthy();
  });

  it("only uses reserved example domains for email, so test emails can never reach a real person", () => {
    for (const p of sample) {
      const domain = p.email.split("@")[1];
      expect(RESERVED_DOMAINS, p.email).toContain(domain);
    }
  });

  it("uses fictional phone numbers (the 555-01xx range reserved for fiction)", () => {
    for (const p of sample) expect(p.phone, p.phone).toMatch(/^\+1-[2-9]\d{2}-555-01\d{2}$/);
  });

  it("derives email and username from the name consistently", () => {
    for (const p of sample) {
      expect(p.fullName).toBe(`${p.firstName} ${p.lastName}`);
      expect(p.email.split("@")[0]).toBe(p.username);
      expect(p.username).toMatch(new RegExp(`^${p.firstName.toLowerCase()}\\.${p.lastName.toLowerCase()}\\d{2}$`));
    }
  });

  it("produces ISO birth dates for adults", () => {
    const thisYear = new Date().getFullYear();
    for (const p of sample) {
      expect(p.birthDate).toMatch(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d)$/);
      expect(thisYear - Number(p.birthDate.slice(0, 4))).toBeGreaterThanOrEqual(18);
    }
  });

  it("varies between calls", () => {
    expect(new Set(sample.map((p) => p.email)).size).toBeGreaterThan(200);
  });
});
