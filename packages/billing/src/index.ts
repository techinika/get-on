export const PLAN_IDS = ["free", "basic", "pro", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type TermMonths = 1 | 3 | 6 | 12 | 24;

export type PlanLimits = {
  maxWebsites: number | null;
  maxPagesPerSite: number | null;
  maxMembers: number | null;
  storageMb: number | null;
  aiMonthlyCredits: number;
  aiDailyActions: number;
  maxCustomDomainsPerSite: number;
  watermark: boolean;
  backups: {
    autoFrequency: "weekly" | "daily";
    autoKeep: number;
    manualMax: number;
    storageMb: number;
  };
  maxRedirects: number;
  exportsPerDay: number;
  siteZipAllowed: boolean;
  siteZipPerDay: number;
  trackedLinksMax: number;
  maxPlugins: number | null;
  monthlyEmails: number;
};

export type PlanFeatures = {
  customDomain: boolean;
  removeWatermark: boolean;
  siteZip: boolean;
  analytics: boolean;
  autoReply: boolean;
};

export type PlanCatalogueEntry = {
  id: PlanId;
  name: string;
  priceMonthlyCents: number;
  limits: PlanLimits;
  features: PlanFeatures;
};

export const PLAN_CATALOGUE: Record<PlanId, PlanCatalogueEntry> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthlyCents: 0,
    limits: {
      maxWebsites: 1,
      maxPagesPerSite: 4,
      maxMembers: 1,
      storageMb: 50,
      aiMonthlyCredits: 25,
      aiDailyActions: 20,
      maxCustomDomainsPerSite: 0,
      watermark: true,
      backups: { autoFrequency: "weekly", autoKeep: 2, manualMax: 2, storageMb: 50 },
      maxRedirects: 5,
      exportsPerDay: 2,
      siteZipAllowed: false,
      siteZipPerDay: 0,
      trackedLinksMax: 5,
      maxPlugins: 1,
      monthlyEmails: 50,
    },
    features: {
      customDomain: false,
      removeWatermark: false,
      siteZip: false,
      analytics: false,
      autoReply: false,
    },
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceMonthlyCents: 799,
    limits: {
      maxWebsites: 3,
      maxPagesPerSite: 15,
      maxMembers: 3,
      storageMb: 500,
      aiMonthlyCredits: 200,
      aiDailyActions: 100,
      maxCustomDomainsPerSite: 1,
      watermark: false,
      backups: { autoFrequency: "weekly", autoKeep: 8, manualMax: 10, storageMb: 500 },
      maxRedirects: 50,
      exportsPerDay: 10,
      siteZipAllowed: true,
      siteZipPerDay: 3,
      trackedLinksMax: 50,
      maxPlugins: 5,
      monthlyEmails: 500,
    },
    features: {
      customDomain: true,
      removeWatermark: true,
      siteZip: true,
      analytics: true,
      autoReply: true,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyCents: 1999,
    limits: {
      maxWebsites: 10,
      maxPagesPerSite: 50,
      maxMembers: 10,
      storageMb: 2048,
      aiMonthlyCredits: 1000,
      aiDailyActions: 500,
      maxCustomDomainsPerSite: 3,
      watermark: false,
      backups: { autoFrequency: "daily", autoKeep: 30, manualMax: 25, storageMb: 2048 },
      maxRedirects: 250,
      exportsPerDay: 50,
      siteZipAllowed: true,
      siteZipPerDay: 15,
      trackedLinksMax: 250,
      maxPlugins: null,
      monthlyEmails: 2500,
    },
    features: {
      customDomain: true,
      removeWatermark: true,
      siteZip: true,
      analytics: true,
      autoReply: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthlyCents: 4999,
    limits: {
      maxWebsites: null,
      maxPagesPerSite: null,
      maxMembers: null,
      storageMb: 10240,
      aiMonthlyCredits: 5000,
      aiDailyActions: 2000,
      maxCustomDomainsPerSite: 10,
      watermark: false,
      backups: { autoFrequency: "daily", autoKeep: 90, manualMax: 100, storageMb: 10240 },
      maxRedirects: 1000,
      exportsPerDay: 200,
      siteZipAllowed: true,
      siteZipPerDay: 50,
      trackedLinksMax: 1000,
      maxPlugins: null,
      monthlyEmails: 10000,
    },
    features: {
      customDomain: true,
      removeWatermark: true,
      siteZip: true,
      analytics: true,
      autoReply: true,
    },
  },
};

export function planFeatures(planId: PlanId): PlanFeatures {
  return (PLAN_CATALOGUE[planId] ?? PLAN_CATALOGUE.free).features;
}

export type TermOption = {
  months: TermMonths;
  discountBps: number;
  label: string;
  active: boolean;
};

export type Coupon = {
  code: string;
  active: boolean;
  percentOffBps: number | null;
  amountOffCents: number | null;
  planIds: PlanId[] | null;
  minMonths: number | null;
  firstPurchaseOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perTeamLimit: number | null;
};

export type Quote = {
  planId: PlanId;
  months: TermMonths;
  currency: string;
  unitMonthlyCents: number;
  grossCents: number;
  termDiscountCents: number;
  couponDiscountCents: number;
  taxCents: number;
  totalCents: number;
  couponCode: string | null;
};

export type TeamAccess = {
  planId: PlanId;
  source: "free" | "subscription" | "grant";
  status: "free" | "active" | "grace" | "lapsed";
  paidThrough: string | null;
  graceEndsAt: string | null;
  currentTermId: string | null;
  grantId: string | null;
  limits: PlanLimits;
  features: PlanFeatures;
};

export function parseTermMonths(value: unknown): TermMonths {
  const n = Number(value);
  if (n === 1 || n === 3 || n === 6 || n === 12 || n === 24) return n;
  return 1;
}

export function validateCoupon(
  coupon: Coupon | null,
  ctx: {
    planId: PlanId;
    months: TermMonths;
    now: Date;
    firstPurchase: boolean;
    redemptionCount: number;
    teamRedemptionCount: number;
  },
): { ok: true; coupon: Coupon } | { ok: false; reason: string; message: string } {
  if (!coupon || !coupon.active) {
    return { ok: false, reason: "not_found", message: "That coupon code was not found." };
  }
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > ctx.now.getTime()) {
    return { ok: false, reason: "not_started", message: "That coupon is not active yet." };
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() <= ctx.now.getTime()) {
    return { ok: false, reason: "expired", message: "That coupon has expired." };
  }
  if (coupon.planIds && coupon.planIds.length > 0 && !coupon.planIds.includes(ctx.planId)) {
    return { ok: false, reason: "wrong_plan", message: "That coupon does not apply to this plan." };
  }
  if (coupon.minMonths && ctx.months < coupon.minMonths) {
    return {
      ok: false,
      reason: "min_months",
      message: `That coupon needs at least ${coupon.minMonths} months.`,
    };
  }
  if (coupon.firstPurchaseOnly && !ctx.firstPurchase) {
    return { ok: false, reason: "first_purchase", message: "That coupon is for a first payment only." };
  }
  if (coupon.maxRedemptions !== null && ctx.redemptionCount >= coupon.maxRedemptions) {
    return { ok: false, reason: "limit_reached", message: "That coupon is no longer available." };
  }
  if (coupon.perTeamLimit !== null && ctx.teamRedemptionCount >= coupon.perTeamLimit) {
    return { ok: false, reason: "team_limit", message: "You already used this coupon." };
  }
  return { ok: true, coupon };
}

export function quote(input: {
  planId: PlanId;
  months: TermMonths;
  terms: TermOption[];
  coupon: Coupon | null;
  taxRateBps: number;
  currency: string;
  now?: Date;
  firstPurchase?: boolean;
}): Quote {
  const plan = PLAN_CATALOGUE[input.planId] ?? PLAN_CATALOGUE.free;
  const unitMonthlyCents = plan.priceMonthlyCents;
  const grossCents = unitMonthlyCents * input.months;
  const term = input.terms.find((t) => t.months === input.months && t.active);
  const termDiscountCents = term ? Math.round((grossCents * term.discountBps) / 10_000) : 0;
  const afterTerm = Math.max(0, grossCents - termDiscountCents);

  let couponDiscountCents = 0;
  let couponCode: string | null = null;
  if (input.coupon && input.coupon.active) {
    couponCode = input.coupon.code;
    if (input.coupon.percentOffBps) {
      couponDiscountCents += Math.round((afterTerm * input.coupon.percentOffBps) / 10_000);
    }
    if (input.coupon.amountOffCents) {
      couponDiscountCents += input.coupon.amountOffCents;
    }
    couponDiscountCents = Math.min(afterTerm, couponDiscountCents);
  }

  const taxable = Math.max(0, afterTerm - couponDiscountCents);
  const taxCents = input.taxRateBps > 0 ? Math.round((taxable * input.taxRateBps) / 10_000) : 0;
  const totalCents = taxable + taxCents;

  return {
    planId: input.planId,
    months: input.months,
    currency: input.currency || "USD",
    unitMonthlyCents,
    grossCents,
    termDiscountCents,
    couponDiscountCents,
    taxCents,
    totalCents,
    couponCode,
  };
}

export function termOptionsWithPrices(planId: PlanId, terms: TermOption[]) {
  return terms
    .filter((t) => t.active)
    .map((term) => {
      const q = quote({
        planId,
        months: term.months,
        terms,
        coupon: null,
        taxRateBps: 0,
        currency: "USD",
      });
      return {
        ...term,
        grossCents: q.grossCents,
        discountCents: q.termDiscountCents,
        savingsCents: q.termDiscountCents,
        totalCents: q.totalCents,
        monthlyCents: Math.round(q.totalCents / term.months),
      };
    });
}

export function termEnd(start: Date, months: TermMonths): Date {
  const end = new Date(start.getTime());
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

export function nextTermStart(
  terms: Array<{
    id: string;
    teamId: string;
    planId: PlanId;
    startsAt: string;
    endsAt: string;
    status: "upcoming" | "active" | "ended" | "cancelled";
    invoiceId: string | null;
  }>,
  now: Date,
): Date {
  let latest = now.getTime();
  for (const term of terms) {
    if (term.status === "cancelled" || term.status === "ended") continue;
    const end = new Date(term.endsAt).getTime();
    if (Number.isFinite(end) && end > latest) latest = end;
  }
  return new Date(latest);
}

export function coverageSummary(
  terms: Array<{
    id: string;
    teamId: string;
    planId: PlanId;
    startsAt: string;
    endsAt: string;
    status: "upcoming" | "active" | "ended" | "cancelled";
    invoiceId: string | null;
  }>,
  now: Date,
) {
  const active = terms.filter(
    (t) =>
      (t.status === "active" || t.status === "upcoming") &&
      new Date(t.endsAt).getTime() > now.getTime(),
  );
  const sorted = [...active].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  return {
    activeCount: sorted.length,
    startsAt: sorted[0]?.startsAt ?? null,
    endsAt: sorted[sorted.length - 1]?.endsAt ?? null,
    nextStart: sorted.length > 0 ? nextTermStart(sorted, now).toISOString() : null,
    terms: sorted,
  };
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
