import type {
  PlanCatalogueEntry,
  PlanFeatures,
  PlanId,
  PlanLimits,
  TermOption,
  TermMonths,
} from "./types";
import { TERM_MONTHS } from "./types";

const FREE: PlanLimits = {
  maxWebsites: 1,
  maxPagesPerSite: 1,
  maxMembers: 1,
  maxPlugins: 1,
  maxTemplates: 1,
  maxCustomDomainsPerSite: 0,
  maxRedirects: 3,
  maxPreviewLinks: 0,
  maxDeletedPending: 2,
  storageMb: 100,
  monthlyEmails: 100,
  aiMonthlyCredits: 0,
  aiDailyActions: 30,
  formsMonthly: 50,
  backups: {
    autoFrequency: "weekly",
    autoKeep: 1,
    manualMax: 1,
    storageMb: 100,
  },
  exportsPerDay: 3,
  siteZipAllowed: false,
  siteZipPerDay: 0,
  trackedLinksMax: 0,
  support: "standard",
  watermark: true,
};

const BASIC: PlanLimits = {
  maxWebsites: 2,
  maxPagesPerSite: 5,
  maxMembers: 1,
  maxPlugins: 2,
  maxTemplates: 3,
  maxCustomDomainsPerSite: 1,
  maxRedirects: 25,
  maxPreviewLinks: 1,
  maxDeletedPending: 3,
  storageMb: 1024,
  monthlyEmails: 1000,
  aiMonthlyCredits: 100,
  aiDailyActions: 100,
  formsMonthly: 500,
  backups: {
    autoFrequency: "daily",
    autoKeep: 7,
    manualMax: 3,
    storageMb: 1024,
  },
  exportsPerDay: 5,
  siteZipAllowed: false,
  siteZipPerDay: 0,
  trackedLinksMax: 5,
  support: "standard",
  watermark: false,
};

const PRO: PlanLimits = {
  maxWebsites: 5,
  maxPagesPerSite: null,
  maxMembers: 5,
  maxPlugins: 5,
  maxTemplates: 20,
  maxCustomDomainsPerSite: 3,
  maxRedirects: 100,
  maxPreviewLinks: 10,
  maxDeletedPending: 5,
  storageMb: 5120,
  monthlyEmails: 5000,
  aiMonthlyCredits: 400,
  aiDailyActions: 300,
  formsMonthly: 5000,
  backups: {
    autoFrequency: "daily",
    autoKeep: 14,
    manualMax: 10,
    storageMb: 5120,
  },
  exportsPerDay: 10,
  siteZipAllowed: true,
  siteZipPerDay: 3,
  trackedLinksMax: 50,
  support: "priority",
  watermark: false,
};

const ENTERPRISE: PlanLimits = {
  maxWebsites: null,
  maxPagesPerSite: null,
  maxMembers: null,
  maxPlugins: null,
  maxTemplates: null,
  maxCustomDomainsPerSite: 10,
  maxRedirects: 500,
  maxPreviewLinks: 1000,
  maxDeletedPending: 10,
  storageMb: 25600,
  monthlyEmails: 25000,
  aiMonthlyCredits: 1500,
  aiDailyActions: 1000,
  formsMonthly: 50000,
  backups: {
    autoFrequency: "daily",
    autoKeep: 30,
    manualMax: 25,
    storageMb: 25600,
  },
  exportsPerDay: 20,
  siteZipAllowed: true,
  siteZipPerDay: 20,
  trackedLinksMax: 500,
  support: "highest",
  watermark: false,
};

export const PLAN_CATALOGUE: Record<PlanId, PlanCatalogueEntry> = {
  free: {
    id: "free",
    name: "Free",
    rank: 0,
    priceMonthlyCents: 0,
    limits: FREE,
  },
  basic: {
    id: "basic",
    name: "Basic",
    rank: 1,
    priceMonthlyCents: 799,
    limits: BASIC,
  },
  pro: {
    id: "pro",
    name: "Pro",
    rank: 2,
    priceMonthlyCents: 1399,
    limits: PRO,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    rank: 3,
    priceMonthlyCents: 5999,
    limits: ENTERPRISE,
  },
};

export const DEFAULT_TERMS: readonly TermOption[] = TERM_MONTHS.map((months) => ({
  months,
  discountBps: termDiscountBps(months),
  label: termLabel(months),
  active: true,
}));

function termDiscountBps(months: TermMonths): number {
  switch (months) {
    case 1:
      return 0;
    case 6:
      return 500;
    case 12:
      return 1000;
    case 24:
      return 1500;
    case 36:
      return 2000;
    case 48:
      return 2500;
    case 60:
      return 3000;
  }
}

export function termLabel(months: TermMonths): string {
  if (months === 1) return "1 month";
  if (months === 12) return "1 year";
  if (months === 24) return "2 years";
  if (months === 60) return "5 years";
  return `${months} months`;
}

export function planCatalogue(planId: PlanId): PlanCatalogueEntry {
  return PLAN_CATALOGUE[planId];
}

export function planRank(planId: PlanId): number {
  return PLAN_CATALOGUE[planId].rank;
}

export function planLimits(planId: PlanId): PlanLimits {
  return PLAN_CATALOGUE[planId].limits;
}

export function planFeatures(planId: PlanId): PlanFeatures {
  const limits = planLimits(planId);
  return {
    customDomain: limits.maxCustomDomainsPerSite > 0,
    removeBadge: !limits.watermark,
    customCode: planRank(planId) >= planRank("pro"),
    analytics: planRank(planId) >= planRank("basic"),
    teamMembers: limits.maxMembers === null || limits.maxMembers > 1,
    plugins: limits.maxPlugins === null || limits.maxPlugins > 1,
    prioritySupport: limits.support !== "standard",
    previewLinks: limits.maxPreviewLinks > 0,
    exports: limits.exportsPerDay > 0,
    siteZip: limits.siteZipAllowed,
    trackedLinks: limits.trackedLinksMax > 0,
  };
}

export function higherPlan(a: PlanId, b: PlanId): PlanId {
  return planRank(a) >= planRank(b) ? a : b;
}
