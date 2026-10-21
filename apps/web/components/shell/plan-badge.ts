import type { PlanId } from "@/lib/plans";

export const PLAN_BADGE: Record<
  PlanId,
  { label: string; variant: "neutral" | "primary" | "accent" }
> = {
  free: { label: "Free", variant: "neutral" },
  basic: { label: "Basic", variant: "primary" },
  pro: { label: "Pro", variant: "primary" },
  enterprise: { label: "Enterprise", variant: "accent" },
};
