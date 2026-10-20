export type PlanId = "free" | "basic" | "pro" | "enterprise";

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceUsdMonthly: number;
  maxWebsites: number | null;
  maxPagesPerSite: number | null;
  maxMembers: number | null;
  maxPlugins: number | null;
  aiCreditsMonthly: number;
  storageMb: number;
  monthlyEmails: number;
  customDomainAllowed: boolean;
  watermarkRequired: boolean;
  supportPriority: "standard" | "priority" | "highest";
};

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceUsdMonthly: 0,
    maxWebsites: 1,
    maxPagesPerSite: 1,
    maxMembers: 1,
    maxPlugins: 1,
    aiCreditsMonthly: 10,
    storageMb: 100,
    monthlyEmails: 0,
    customDomainAllowed: false,
    watermarkRequired: true,
    supportPriority: "standard",
  },
  {
    id: "basic",
    name: "Basic",
    priceUsdMonthly: 7.99,
    maxWebsites: 2,
    maxPagesPerSite: 5,
    maxMembers: 1,
    maxPlugins: 2,
    aiCreditsMonthly: 100,
    storageMb: 1024,
    monthlyEmails: 1000,
    customDomainAllowed: true,
    watermarkRequired: false,
    supportPriority: "standard",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsdMonthly: 13.99,
    maxWebsites: 5,
    maxPagesPerSite: null,
    maxMembers: 5,
    maxPlugins: 5,
    aiCreditsMonthly: 400,
    storageMb: 5120,
    monthlyEmails: 5000,
    customDomainAllowed: true,
    watermarkRequired: false,
    supportPriority: "priority",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceUsdMonthly: 59.99,
    maxWebsites: null,
    maxPagesPerSite: null,
    maxMembers: null,
    maxPlugins: null,
    aiCreditsMonthly: 1500,
    storageMb: 25600,
    monthlyEmails: 25000,
    customDomainAllowed: true,
    watermarkRequired: false,
    supportPriority: "highest",
  },
];

export const PLAN_BY_ID = Object.fromEntries(
  PLAN_DEFINITIONS.map((plan) => [plan.id, plan]),
) as Record<PlanId, PlanDefinition>;

export function describeLimit(value: number | null, label: string) {
  return value === null ? `Unlimited ${label}` : `${value} ${label}`;
}
