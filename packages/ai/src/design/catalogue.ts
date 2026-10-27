import { DESIGN_CATALOGUE, type CatalogueItem } from "@get-on/blocks";

function line(item: CatalogueItem): string {
  return `- ${item.id}: ${item.label}. ${item.description} Use: ${item.whenToUse} Avoid: ${item.avoidWhen}.${item.synonyms.length ? ` Words: ${item.synonyms.join(", ")}.` : ""}`;
}

function lines(items: CatalogueItem[]): string {
  return items.map(line).join("\n");
}

export function designCatalogueExcerpt(parts: Array<keyof typeof DESIGN_CATALOGUE> = [
  "heroLayouts",
  "headerStyles",
  "footerLayouts",
  "designOptions",
  "blockVariants",
  "archetypes",
]): string {
  const output: string[] = [];
  for (const part of parts) {
    const value = DESIGN_CATALOGUE[part];
    if (Array.isArray(value)) {
      output.push(`<catalogue part="${part}">\n${lines(value as CatalogueItem[])}\n</catalogue>`);
      continue;
    }
    for (const [group, items] of Object.entries(value as Record<string, CatalogueItem[]>)) {
      output.push(`<catalogue part="${part}.${group}">\n${lines(items)}\n</catalogue>`);
    }
  }
  return output.join("\n");
}

export function designCatalogueIds(part: keyof typeof DESIGN_CATALOGUE): string[] {
  const value = DESIGN_CATALOGUE[part];
  if (Array.isArray(value)) return (value as CatalogueItem[]).map((item) => item.id);
  return Object.values(value as Record<string, CatalogueItem[]>).flatMap((items) => items.map((item) => item.id));
}
