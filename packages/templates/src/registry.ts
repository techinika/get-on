import type { TemplateCatalogItem, TemplatePackage } from "./types";
import { TEMPLATE_CATALOG, catalogItem } from "./catalog";
import { starterTemplate } from "../system/starter";
import { softwareCompanyTemplate } from "../system/software-company";
import { lawFirmTemplate } from "../system/law-firm";
import { restaurantTemplate } from "../system/restaurant";
import { developerPortfolioTemplate } from "../system/developer-portfolio";
import { salonBeautyTemplate } from "../system/salon-beauty";
import { boutiqueShopTemplate } from "../system/boutique-shop";
import { homeServicesTemplate } from "../system/home-services";
import { communityChurchTemplate } from "../system/community-church";
import { creativeStudioTemplate } from "../system/creative-studio";

export const SYSTEM_TEMPLATES: TemplatePackage[] = [
  starterTemplate,
  softwareCompanyTemplate,
  lawFirmTemplate,
  restaurantTemplate,
  developerPortfolioTemplate,
  salonBeautyTemplate,
  boutiqueShopTemplate,
  homeServicesTemplate,
  communityChurchTemplate,
  creativeStudioTemplate,
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
