import {
  PLAN_CATALOGUE,
  PLAN_IDS,
  planFeatures,
  type PlanId as BillingPlanId,
} from "@get-on/billing";

export type PlanId = BillingPlanId;

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthly: number | null;
  maxWebsites: number | null;
  maxPagesPerSite: number | null;
  maxMembers: number | null;
  storageMb: number | null;
  aiMonthlyCredits: number;
  aiDailyActions: number;
  customDomainAllowed: boolean;
  customDomainsPerSite: number;
  watermarked: boolean;
  backupAutoFrequency: "weekly" | "daily";
  backupAutoKeep: number;
  backupManualMax: number;
  backupStorageMb: number;
  redirectsMax: number;
  exportsPerDay: number;
};

function toPlan(id: PlanId): Plan {
  const catalogue = PLAN_CATALOGUE[id];
  const limits = catalogue.limits;
  return {
    id,
    name: catalogue.name,
    priceMonthly:
      id === "free" ? null : catalogue.priceMonthlyCents / 100,
    maxWebsites: limits.maxWebsites,
    maxPagesPerSite: limits.maxPagesPerSite,
    maxMembers: limits.maxMembers,
    storageMb: limits.storageMb,
    aiMonthlyCredits: limits.aiMonthlyCredits,
    aiDailyActions: limits.aiDailyActions,
    customDomainAllowed: planFeatures(id).customDomain,
    customDomainsPerSite: limits.maxCustomDomainsPerSite,
    watermarked: limits.watermark,
    backupAutoFrequency: limits.backups.autoFrequency,
    backupAutoKeep: limits.backups.autoKeep,
    backupManualMax: limits.backups.manualMax,
    backupStorageMb: limits.backups.storageMb,
    redirectsMax: limits.maxRedirects,
    exportsPerDay: limits.exportsPerDay,
  };
}

export const PLAN_BY_ID: Record<PlanId, Plan> = {
  free: toPlan("free"),
  basic: toPlan("basic"),
  pro: toPlan("pro"),
  enterprise: toPlan("enterprise"),
};

export function planLimits(planId: string): Plan {
  return PLAN_BY_ID[planId as PlanId] ?? PLAN_BY_ID.free;
}

export interface PlanDefinition extends Plan {
  priceUsdMonthly: number;
  maxPlugins: number | null;
  monthlyEmails: number;
  watermarkRequired: boolean;
  priceMonthlyDisplay?: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = PLAN_IDS.map((id) => {
  const catalogue = PLAN_CATALOGUE[id];
  const limits = catalogue.limits;
  return {
    ...PLAN_BY_ID[id],
    priceUsdMonthly: catalogue.priceMonthlyCents / 100,
    maxPlugins: limits.maxPlugins,
    monthlyEmails: limits.monthlyEmails,
    watermarkRequired: limits.watermark,
    priceMonthlyDisplay:
      id === "free" ? "Free" : `$${(catalogue.priceMonthlyCents / 100).toFixed(2)}`,
  };
});

export { PLAN_IDS };
