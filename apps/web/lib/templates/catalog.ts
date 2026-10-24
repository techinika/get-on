import { TEMPLATE_CATALOG, type TemplateCatalogItem } from "@get-on/templates/catalog";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";
import type { GalleryTemplate } from "@/components/templates/template-gallery";

const PLAN_RANK: Record<PlanId, number> = { free: 0, basic: 1, pro: 2, enterprise: 3 };
const TEMPLATE_PLAN: Record<TemplateCatalogItem["planMin"], PlanId> = {
  free: "free",
  basic: "basic",
  pro: "pro",
  enterprise: "enterprise",
};

export function templatesForPlan(planId: PlanId): GalleryTemplate[] {
  return TEMPLATE_CATALOG.map((item) => {
    const required = TEMPLATE_PLAN[item.planMin];
    return {
      ...item,
      available: PLAN_RANK[planId] >= PLAN_RANK[required],
      requiredPlan: required === "free" ? undefined : PLAN_BY_ID[required].name,
    };
  });
}

export function templateBySlug(slug: string): TemplateCatalogItem | undefined {
  return TEMPLATE_CATALOG.find((item) => item.slug === slug);
}

export function templateAvailable(planId: PlanId, slug: string): boolean {
  const item = templateBySlug(slug);
  if (!item) return false;
  return PLAN_RANK[planId] >= PLAN_RANK[TEMPLATE_PLAN[item.planMin]];
}

export function templateName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return templateBySlug(slug)?.name ?? null;
}
