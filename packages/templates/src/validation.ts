import { validateContent } from "@get-on/blocks";
import type { TemplatePackage } from "./types";

export type PackageIssue = { path: string; message: string };

const CATEGORIES = new Set([
  "starter", "software", "professional", "restaurant", "shop", "health-beauty",
  "portfolio", "community", "education", "other",
]);
const PLANS = new Set(["free", "basic", "pro", "enterprise"]);

export function validateTemplatePackage(value: unknown): {
  ok: boolean;
  issues: PackageIssue[];
  pkg?: TemplatePackage;
} {
  const issues: PackageIssue[] = [];
  if (!value || typeof value !== "object") {
    return { ok: false, issues: [{ path: "", message: "Template package must be an object." }] };
  }
  const pkg = value as TemplatePackage;
  const meta = pkg.meta;
  if (!meta || typeof meta !== "object") {
    issues.push({ path: "meta", message: "Template name and description are required." });
  } else {
    if (!meta.slug || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(meta.slug)) {
      issues.push({ path: "meta.slug", message: "Use a short web-safe name." });
    }
    if (!meta.name?.trim()) issues.push({ path: "meta.name", message: "A name is required." });
    if (!meta.tagline?.trim()) issues.push({ path: "meta.tagline", message: "A tagline is required." });
    if (!CATEGORIES.has(meta.category)) issues.push({ path: "meta.category", message: "Choose a category." });
    if (!PLANS.has(meta.planMin)) issues.push({ path: "meta.planMin", message: "Choose a plan." });
  }
  if (!Array.isArray(pkg.compositions) || pkg.compositions.length === 0) {
    issues.push({ path: "compositions", message: "A template needs at least one design." });
    return { ok: false, issues };
  }
  const seenKeys = new Set<string>();
  const seenPaths = new Set<string>();
  for (const [compositionIndex, composition] of pkg.compositions.entries()) {
    if (!composition.theme) {
      issues.push({ path: `compositions[${compositionIndex}].theme`, message: "Choose colours and fonts." });
    }
    const homes = composition.pages.filter((page) => page.isHome);
    if (homes.length !== 1) {
      issues.push({
        path: `compositions[${compositionIndex}].pages`,
        message: "A design needs exactly one home page.",
      });
    }
    for (const [pageIndex, page] of composition.pages.entries()) {
      const at = `compositions[${compositionIndex}].pages[${pageIndex}]`;
      if (!page.key?.trim()) issues.push({ path: `${at}.key`, message: "Each page needs a key." });
      if (!page.title?.trim()) issues.push({ path: `${at}.title`, message: "Each page needs a title." });
      if (!page.path?.startsWith("/")) issues.push({ path: `${at}.path`, message: "Page paths must start with /." });
      if (seenKeys.has(page.key)) issues.push({ path: `${at}.key`, message: "Page keys must be unique." });
      if (seenPaths.has(page.path)) issues.push({ path: `${at}.path`, message: "Page paths must be unique." });
      seenKeys.add(page.key);
      seenPaths.add(page.path);
      if (page.blocks.length > 60) {
        issues.push({ path: `${at}.blocks`, message: "A page can have at most 60 sections." });
      }
      const content = validateContent({ schemaVersion: 4, blocks: page.blocks });
      if (!content.ok) {
        for (const issue of content.issues ?? []) {
          issues.push({ path: `${at}.blocks.${issue.path?.join(".") ?? ""}`, message: String(issue.message) });
        }
      }
    }
  }
  return { ok: issues.length === 0, issues, pkg };
}

export function packageSummary(pkg: TemplatePackage) {
  const pages = pkg.compositions[0]?.pages ?? [];
  return {
    pageCount: pages.length,
    blockCount: pages.reduce((total, page) => total + page.blocks.length, 0),
    requiredPlugins: ["contact"],
  };
}
