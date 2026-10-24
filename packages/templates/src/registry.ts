import type { TemplateCatalogItem, TemplatePackage } from "./types";
import { TEMPLATE_CATALOG, catalogItem } from "./catalog";
import { starterTemplate } from "../system/starter";
import { softwareCompanyTemplate } from "../system/software-company";
import { lawFirmTemplate } from "../system/law-firm";
import { restaurantTemplate } from "../system/restaurant";
import { developerPortfolioTemplate } from "../system/developer-portfolio";

export const SYSTEM_TEMPLATES: TemplatePackage[] = [
  starterTemplate,
  softwareCompanyTemplate,
  lawFirmTemplate,
  restaurantTemplate,
  developerPortfolioTemplate,
];

export function listSystemTemplates(): TemplatePackage[] {
  return SYSTEM_TEMPLATES;
}

export function getSystemTemplate(slug: string): TemplatePackage | undefined {
  return SYSTEM_TEMPLATES.find((pkg) => pkg.meta.slug === slug);
}

export function requireSystemTemplate(slug: string): TemplatePackage {
  const pkg = getSystemTemplate(slug);
  if (!pkg) throw new Error(`Unknown template: ${slug}`);
  return pkg;
}

export function listTemplateCatalog(): TemplateCatalogItem[] {
  return TEMPLATE_CATALOG;
}

export { catalogItem };
