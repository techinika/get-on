import { randomUUID } from "node:crypto";
import { migrateContent } from "@get-on/blocks";
import type { Block, Composition, SampleProfile, TemplatePackage } from "./types";
import {
  applyVisibility,
  resolveDeep,
  scanSampleLeaks,
  variableValues,
} from "./variables";

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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** @deprecated Use variableValues(). Kept for old template packages. */
export function profileTokens(profile: SampleProfile): Record<string, string> {
  return variableValues(profile);
}

function freshBlock(block: Block): Block {
  const copy = clone(block);
  copy.id = randomUUID().replace(/-/g, "").slice(0, 20);
  return copy;
}

const SAMPLE_ONLY_TYPES = new Set([
  "testimonials",
  "stats",
  "team",
  "pricing",
  "menu",
  "products",
  "projects",
  "logos",
]);
const SAMPLE_MARKER_RE = /\b(sample|placeholder|lorem ipsum)\b/i;

function hasSampleMarker(value: unknown): boolean {
  if (typeof value === "string") return SAMPLE_MARKER_RE.test(value);
  if (Array.isArray(value)) return value.some(hasSampleMarker);
  if (value && typeof value === "object") return Object.values(value).some(hasSampleMarker);
  return false;
}

/**
 * Marks sections that still contain template sample content. The marker lives
 * on the block so the editor and publish check can warn without guessing from
 * the visible words later.
 */
function markSampleOnly(block: Block): Block {
  if (
    SAMPLE_ONLY_TYPES.has(String(block.type)) ||
    hasSampleMarker(block.props)
  ) {
    return { ...block, sampleOnly: true };
  }
  return block;
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

  const blank: SampleProfile = {
    businessName: "",
    tagline: "",
    description: "",
    phone: "",
    email: "",
    address: "",
    hoursNote: "",
    social: [],
  };
  const profile: SampleProfile = {
    ...(options.profile ? blank : pkg.sampleProfile),
    ...options.profile,
  };
  const values = variableValues(profile);
  const missing = new Set<string>();
  const sourcePages = limitPages(composition.pages, options.maxPages);
  const pageIdByKey = new Map<string, string>();
  for (const page of sourcePages) pageIdByKey.set(page.key, randomUUID());
  const homeId = pageIdByKey.get(sourcePages.find((page) => page.isHome)?.key ?? sourcePages[0]!.key)!;

  for (const [key, id] of pageIdByKey) values[`${key}PageId`] = id;

  const pages: MaterializedPage[] = sourcePages.map((page, index) => {
    const resolved = applyVisibility(
      resolveDeep(page.blocks, values, missing),
      profile,
      missing,
    );
    const content = migrateContent(resolved);
    const blocks = content.blocks
      .filter((block): block is Block => Boolean(block))
      .map((block: Block) =>
        markSampleOnly(fixPageLinks(freshBlock(block), homeId) as Block),
      );
    const leaks = scanSampleLeaks(blocks, pkg.sampleProfile);
    if (leaks.length > 0) {
      throw new Error(
        `TEMPLATE_SAMPLE_LEAK:${pkg.meta.slug}:${page.key}:${leaks.map((leak) => leak.value).join(",")}`,
      );
    }
    const title = String(resolveDeep(page.title, values, missing));
    const seoTitle = String(resolveDeep(page.seo.title, values, missing));
    const seoDescription = String(resolveDeep(page.seo.description, values, missing));
    return {
      id: pageIdByKey.get(page.key)!,
      title,
      path: page.path,
      position: index,
      isHome: page.isHome,
      showInMenu: page.showInMenu,
      menuLabel: page.menuLabel ?? title,
      seoTitle,
      seoDescription,
      blocks,
    };
  });

  const theme = applyVisibility(
    resolveDeep(composition.theme, values, missing),
    profile,
    missing,
  ) as Composition["theme"];

  return {
    slug: pkg.meta.slug,
    name: pkg.meta.name,
    theme: clone(theme),
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
