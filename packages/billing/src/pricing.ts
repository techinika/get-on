import { DEFAULT_TERMS, planCatalogue } from "./catalogue";
import { applyBps, clampBps, clampCents, roundHalfUp } from "./money";
import type {
  Coupon,
  CouponValidation,
  PlanId,
  Quote,
  QuoteInput,
  TermMonths,
  TermOption,
} from "./types";

function termFor(input: QuoteInput): TermOption {
  const terms = input.terms ?? DEFAULT_TERMS;
  return (
    terms.find((term) => term.months === input.months) ?? {
      months: input.months,
      discountBps: 0,
      label: `${input.months} months`,
      active: false,
    }
  );
}

export function couponDiscount(
  subtotalCents: number,
  coupon: Coupon | null | undefined,
): number {
  if (!coupon) return 0;
  const percent = coupon.percentOffBps
    ? applyBps(subtotalCents, coupon.percentOffBps)
    : 0;
  const fixed = coupon.amountOffCents ? clampCents(coupon.amountOffCents) : 0;
  return clampCents(Math.max(percent, fixed), 0) > subtotalCents
    ? subtotalCents
    : clampCents(Math.max(percent, fixed));
}

export function validateCoupon(
  coupon: Coupon | null | undefined,
  input: Pick<
    QuoteInput,
    | "planId"
    | "months"
    | "now"
    | "firstPurchase"
    | "redemptionCount"
    | "teamRedemptionCount"
  >,
): CouponValidation {
  if (!coupon) {
    return { ok: false, reason: "inactive", message: "That code is not valid." };
  }
  if (!coupon.active) {
    return {
      ok: false,
      reason: "inactive",
      message: "That code is not valid for this plan.",
    };
  }
  const now = input.now ?? new Date();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now.getTime()) {
    return {
      ok: false,
      reason: "not_started",
      message: "That code is not ready yet.",
    };
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: "expired",
      message: "That code has expired.",
    };
  }
  if (coupon.planIds && !coupon.planIds.includes(input.planId)) {
    return {
      ok: false,
      reason: "wrong_plan",
      message: "That code is not valid for this plan.",
    };
  }
  if (coupon.minMonths !== null && input.months < coupon.minMonths) {
    return {
      ok: false,
      reason: "term_too_short",
      message: `That code needs a term of at least ${coupon.minMonths} months.`,
    };
  }
  if (coupon.firstPurchaseOnly && input.firstPurchase === false) {
    return {
      ok: false,
      reason: "first_purchase_only",
      message: "That code is only for a first payment.",
    };
  }
  if (
    coupon.maxRedemptions !== null &&
    (input.redemptionCount ?? 0) >= coupon.maxRedemptions
  ) {
    return {
      ok: false,
      reason: "used_up",
      message: "That code has been used up.",
    };
  }
  if (
    coupon.perTeamLimit !== null &&
    (input.teamRedemptionCount ?? 0) >= coupon.perTeamLimit
  ) {
    return {
      ok: false,
      reason: "team_limit",
      message: "That code has already been used by your team.",
    };
  }
  return { ok: true, coupon };
}

/**
 * The only pricing function. A caller may display a cached quote, but it must
 * call this again before creating an invoice or starting a payment.
 */
export function quote(input: QuoteInput): Quote {
  const plan = planCatalogue(input.planId);
  const term = termFor(input);
  const grossCents = plan.priceMonthlyCents * input.months;
  const termDiscountBps = term.active ? clampBps(term.discountBps) : 0;
  const termDiscountCents = applyBps(grossCents, termDiscountBps);
  const afterTerm = clampCents(grossCents - termDiscountCents);

  const checked = validateCoupon(input.coupon, input);
  const coupon = checked.ok ? checked.coupon : null;
  const couponDiscountCents = couponDiscount(afterTerm, coupon);
  const subtotalCents = clampCents(afterTerm - couponDiscountCents);
  const taxCents = applyBps(subtotalCents, input.taxRateBps ?? 0);
  const totalCents = subtotalCents + taxCents;

  return {
    planId: input.planId,
    months: input.months,
    currency: (input.currency ?? "USD").toUpperCase(),
    monthlyPriceCents: plan.priceMonthlyCents,
    grossCents,
    termDiscountBps,
    termDiscountCents,
    couponDiscountCents,
    subtotalCents,
    taxCents,
    totalCents,
    effectiveMonthlyCents: roundHalfUp(totalCents / input.months),
    savingsCents: termDiscountCents + couponDiscountCents,
    couponCode: coupon?.code.toUpperCase() ?? null,
  };
}

export function quoteWithoutCoupon(input: QuoteInput): Quote {
  return quote({ ...input, coupon: null });
}

export function termOptionsWithPrices(
  planId: PlanId,
  terms: readonly TermOption[] = DEFAULT_TERMS,
): Array<TermOption & { totalCents: number; effectiveMonthlyCents: number; savingsCents: number }> {
  return terms.map((term) => {
    const result = quote({ planId, months: term.months, terms });
    return {
      ...term,
      totalCents: result.totalCents,
      effectiveMonthlyCents: result.effectiveMonthlyCents,
      savingsCents: result.savingsCents,
    };
  });
}

export function isTermMonths(value: unknown): value is TermMonths {
  return value === 1 || value === 6 || value === 12 || value === 24 || value === 36 || value === 48 || value === 60;
}

export function parseTermMonths(value: unknown): TermMonths | null {
  const number = typeof value === "number" ? value : Number(value);
  return isTermMonths(number) ? number : null;
}
