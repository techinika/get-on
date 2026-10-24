import { randomUUID } from "node:crypto";
import { migrateContent } from "@get-on/blocks";
import type { Block, Composition, SampleProfile, TemplatePackage } from "./types";

export type MaterializedPage = {
  id: string;
  title: string;
  path: string;
  position: number;
  isHome: boolean;
  showInMenu: boolean;
  menuLabel: string;
  seoTitle: string;
  seoDescription: string;
  blocks: Block[];
};

export type MaterializedTemplate = {
  slug: string;
  name: string;
  theme: Composition["theme"];
  pages: MaterializedPage[];
  compositionId: string;
};

export type MaterializeOptions = {
  profile?: Partial<SampleProfile>;
  /** Plan page limit. The home page is always kept. */
  maxPages?: number | null;
  compositionId?: string;
};

const TOKEN_KEYS = [
  "businessName",
  "tagline",
  "description",
  "phone",
  "email",
  "address",
  "hoursNote",
] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceString(value: string, tokens: Record<string, string>): string {
  let out = value;
  for (const [key, replacement] of Object.entries(tokens)) {
    out = out.split(`{{${key}}}`).join(replacement);
  }
  return out;
}

function replaceDeep(value: unknown, tokens: Record<string, string>): unknown {
  if (typeof value === "string") return replaceString(value, tokens);
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, tokens));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = replaceDeep(child, tokens);
    return out;
  }
  return value;
}

export function profileTokens(profile: SampleProfile): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const key of TOKEN_KEYS) tokens[key] = String(profile[key] ?? "");
  return tokens;
}

function freshBlock(block: Block): Block {
  const copy = clone(block);
  copy.id = randomUUID().replace(/-/g, "").slice(0, 20);
  return copy;
}

function fixPageLinks(value: unknown, homeId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => fixPageLinks(item, homeId));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "pageId" && typeof child === "string" && child.startsWith("{{")) {
      out[key] = homeId;
    } else {
      out[key] = fixPageLinks(child, homeId);
    }
  }
  return out;
}

function limitPages(pages: TemplatePackage["compositions"][number]["pages"], maxPages?: number | null) {
  if (maxPages === null || maxPages === undefined) return pages;
  if (maxPages <= 0) maxPages = 1;
  const sorted = [...pages].sort((a, b) => Number(b.isHome) - Number(a.isHome) || a.priority - b.priority);
  return sorted.slice(0, Math.max(1, maxPages));
}

/**
 * Turns a template package into rows that can be written to a website.
 * Page and block ids are freshly generated, so the new website never shares
 * ids or object references with the template or another website.
 */
export function materializeTemplate(
  pkg: TemplatePackage,
  options: MaterializeOptions = {},
): MaterializedTemplate {
  const composition =
    pkg.compositions.find((item) => item.id === options.compositionId) ?? pkg.compositions[0];
  if (!composition) throw new Error("TEMPLATE_HAS_NO_COMPOSITION");

  const profile: SampleProfile = { ...pkg.sampleProfile, ...options.profile };
  const tokens = profileTokens(profile);
  const sourcePages = limitPages(composition.pages, options.maxPages);
  const pageIdByKey = new Map<string, string>();
  for (const page of sourcePages) pageIdByKey.set(page.key, randomUUID());
  const homeId = pageIdByKey.get(sourcePages.find((page) => page.isHome)?.key ?? sourcePages[0]!.key)!;

  for (const [key, id] of pageIdByKey) tokens[`${key}PageId`] = id;

  const pages: MaterializedPage[] = sourcePages.map((page, index) => {
    const content = migrateContent(replaceDeep(page.blocks, tokens));
    const blocks = content.blocks.map((block: Block) =>
      fixPageLinks(freshBlock(block), homeId) as Block,
    );
    return {
      id: pageIdByKey.get(page.key)!,
      title: page.title,
      path: page.path,
      position: index,
      isHome: page.isHome,
      showInMenu: page.showInMenu,
      menuLabel: page.menuLabel ?? page.title,
      seoTitle: page.seo.title,
      seoDescription: page.seo.description,
      blocks,
    };
  });

  return {
    slug: pkg.meta.slug,
    name: pkg.meta.name,
    theme: clone(composition.theme),
    pages,
    compositionId: composition.id,
  };
}

export function templatePageCount(pkg: TemplatePackage, maxPages?: number | null): number {
  const composition = pkg.compositions[0];
  if (!composition) return 0;
  if (maxPages === null || maxPages === undefined) return composition.pages.length;
  return Math.min(Math.max(1, maxPages), composition.pages.length);
}
