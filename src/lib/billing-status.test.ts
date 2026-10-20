import { describe, expect, it } from "vitest";
import { effectiveTier, isEntitledStatus } from "./billing-status";

describe("which Stripe statuses grant a paid plan", () => {
  it("only active and trialing do", () => {
    expect(isEntitledStatus("active")).toBe(true);
    expect(isEntitledStatus("trialing")).toBe(true);
    for (const s of ["past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused", "something_new"]) {
      expect(isEntitledStatus(s)).toBe(false);
    }
  });
});

describe("effectiveTier", () => {
  it("is FREE without a subscription row", () => {
    expect(effectiveTier(null)).toBe("FREE");
    expect(effectiveTier(undefined)).toBe("FREE");
  });
  it("keeps a paid tier while the subscription is in good standing", () => {
    expect(effectiveTier({ tier: "PRO", status: "active" })).toBe("PRO");
    expect(effectiveTier({ tier: "STARTER", status: "trialing" })).toBe("STARTER");
  });
  it("drops to FREE when payment is failing or the subscription has ended", () => {
    for (const status of ["past_due", "unpaid", "incomplete", "incomplete_expired", "canceled", "paused"]) {
      expect(effectiveTier({ tier: "PRO", status })).toBe("FREE");
    }
  });
  it("trusts a paid tier that has no Stripe status at all (a grant made by hand in the database)", () => {
    expect(effectiveTier({ tier: "PRO", status: null })).toBe("PRO");
    expect(effectiveTier({ tier: "STARTER" })).toBe("STARTER");
  });
  it("FREE stays FREE", () => {
    expect(effectiveTier({ tier: "FREE", status: "active" })).toBe("FREE");
  });
});
