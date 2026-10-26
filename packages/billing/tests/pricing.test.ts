import { describe, expect, it } from "vitest";
import { DEFAULT_TERMS } from "../src/catalogue";
import { quote, validateCoupon } from "../src/pricing";
import type { Coupon } from "../src/types";

const coupon = (overrides: Partial<Coupon> = {}): Coupon => ({
  code: "WELCOME",
  active: true,
  percentOffBps: 1000,
  amountOffCents: null,
  planIds: null,
  minMonths: null,
  firstPurchaseOnly: false,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  perTeamLimit: null,
  ...overrides,
});

describe("quote", () => {
  it("prices one month at the plan price", () => {
    const result = quote({ planId: "basic", months: 1 });
    expect(result.grossCents).toBe(799);
    expect(result.termDiscountCents).toBe(0);
    expect(result.totalCents).toBe(799);
  });

  it("applies the term discount before tax", () => {
    const result = quote({ planId: "pro", months: 12, taxRateBps: 1600 });
    expect(result.grossCents).toBe(16788);
    expect(result.termDiscountBps).toBe(1000);
    expect(result.termDiscountCents).toBe(1679);
    expect(result.subtotalCents).toBe(15109);
    expect(result.taxCents).toBe(2417);
    expect(result.totalCents).toBe(17526);
    expect(result.savingsCents).toBe(1679);
  });

  it("applies a percentage coupon to the term-discounted price", () => {
    const result = quote({
      planId: "basic",
      months: 6,
      coupon: coupon({ percentOffBps: 2000 }),
    });
    expect(result.grossCents).toBe(4794);
    expect(result.termDiscountCents).toBe(240);
    expect(result.couponDiscountCents).toBe(911);
    expect(result.totalCents).toBe(3643);
  });

  it("never discounts below zero", () => {
    const result = quote({
      planId: "basic",
      months: 1,
      coupon: coupon({ percentOffBps: null, amountOffCents: 10_000 }),
    });
    expect(result.subtotalCents).toBe(0);
    expect(result.totalCents).toBe(0);
  });

  it("ignores a coupon that is not valid", () => {
    const result = quote({
      planId: "basic",
      months: 1,
      coupon: coupon({ active: false }),
    });
    expect(result.couponDiscountCents).toBe(0);
    expect(result.couponCode).toBeNull();
  });

  it("uses the configured term discount", () => {
    const terms = DEFAULT_TERMS.map((term) =>
      term.months === 1 ? { ...term, discountBps: 2500 } : term,
    );
    const result = quote({ planId: "basic", months: 1, terms });
    expect(result.termDiscountCents).toBe(200);
    expect(result.totalCents).toBe(599);
  });

  it("keeps money in whole cents", () => {
    for (const planId of ["free", "basic", "pro", "enterprise"] as const) {
      for (const months of [1, 6, 12, 24, 36, 48, 60] as const) {
        const result = quote({ planId, months, taxRateBps: 725 });
        expect(Number.isInteger(result.totalCents)).toBe(true);
        expect(result.totalCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("coupon validation", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("accepts an active code for the plan and term", () => {
    expect(validateCoupon(coupon(), { planId: "basic", months: 6, now }).ok).toBe(true);
  });

  it("rejects an expired code", () => {
    const result = validateCoupon(
      coupon({ endsAt: "2026-10-25T00:00:00Z" }),
      { planId: "basic", months: 6, now },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a code for another plan", () => {
    const result = validateCoupon(coupon({ planIds: ["pro"] }), {
      planId: "basic",
      months: 6,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_plan");
  });

  it("rejects a term that is too short", () => {
    const result = validateCoupon(coupon({ minMonths: 12 }), {
      planId: "basic",
      months: 6,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("term_too_short");
  });

  it("rejects a first-purchase code for an existing customer", () => {
    const result = validateCoupon(coupon({ firstPurchaseOnly: true }), {
      planId: "basic",
      months: 6,
      now,
      firstPurchase: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("first_purchase_only");
  });

  it("rejects a used-up code", () => {
    const result = validateCoupon(coupon({ maxRedemptions: 2 }), {
      planId: "basic",
      months: 6,
      now,
      redemptionCount: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("used_up");
  });

  it("rejects a code the team already used", () => {
    const result = validateCoupon(coupon({ perTeamLimit: 1 }), {
      planId: "basic",
      months: 6,
      now,
      teamRedemptionCount: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("team_limit");
  });
});
