export type PlanId = "free" | "basic" | "pro" | "enterprise";

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

export const PLAN_BY_ID: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: null,
    maxWebsites: 1,
    maxPagesPerSite: 1,
    maxMembers: 1,
    storageMb: 100,
    aiMonthlyCredits: 0,
    aiDailyActions: 30,
    customDomainAllowed: false,
    customDomainsPerSite: 0,
    watermarked: true,
    backupAutoFrequency: "weekly",
    backupAutoKeep: 1,
    backupManualMax: 1,
    backupStorageMb: 100,
    redirectsMax: 3,
    exportsPerDay: 3,
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceMonthly: 9,
    maxWebsites: 3,
    maxPagesPerSite: 10,
    maxMembers: 1,
    storageMb: 500,
    aiMonthlyCredits: 100,
    aiDailyActions: 100,
    customDomainAllowed: true,
    customDomainsPerSite: 1,
    watermarked: false,
    backupAutoFrequency: "daily",
    backupAutoKeep: 7,
    backupManualMax: 3,
    backupStorageMb: 500,
    redirectsMax: 25,
    exportsPerDay: 5,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    maxWebsites: 10,
    maxPagesPerSite: 50,
    maxMembers: 5,
    storageMb: 2048,
    aiMonthlyCredits: 400,
    aiDailyActions: 300,
    customDomainAllowed: true,
    customDomainsPerSite: 3,
    watermarked: false,
    backupAutoFrequency: "daily",
    backupAutoKeep: 14,
    backupManualMax: 10,
    backupStorageMb: 2048,
    redirectsMax: 100,
    exportsPerDay: 10,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: null,
    maxWebsites: null,
    maxPagesPerSite: null,
    maxMembers: null,
    storageMb: 10240,
    aiMonthlyCredits: 1500,
    aiDailyActions: 1000,
    customDomainAllowed: true,
    customDomainsPerSite: 10,
    watermarked: false,
    backupAutoFrequency: "daily",
    backupAutoKeep: 30,
    backupManualMax: 25,
    backupStorageMb: 10240,
    redirectsMax: 500,
    exportsPerDay: 20,
  },
};

export function planLimits(planId: string): Plan {
  return PLAN_BY_ID[(planId as PlanId)] ?? PLAN_BY_ID.free;
}

export interface PlanDefinition extends Plan {
  priceUsdMonthly: number;
  maxPlugins: number | null;
  monthlyEmails: number;
  watermarkRequired: boolean;
  priceMonthlyDisplay?: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    ...PLAN_BY_ID.free,
    priceUsdMonthly: 0,
    maxPlugins: 1,
    monthlyEmails: 100,
    watermarkRequired: true,
    priceMonthlyDisplay: "Free",
  },
  {
    ...PLAN_BY_ID.basic,
    priceUsdMonthly: 7.99,
    maxPlugins: 5,
    monthlyEmails: 500,
    watermarkRequired: false,
  },
  {
    ...PLAN_BY_ID.pro,
    priceUsdMonthly: 13.99,
    maxPlugins: 15,
    monthlyEmails: 2000,
    watermarkRequired: false,
  },
  {
    ...PLAN_BY_ID.enterprise,
    priceUsdMonthly: 59.99,
    maxPlugins: null,
    monthlyEmails: 10000,
    watermarkRequired: false,
  },
];
