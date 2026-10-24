export type SeoCheck = {
  id: string;
  title: string;
  detail?: string;
  status: "ok" | "warn" | "bad" | "tip";
  fixHref?: string;
};

export function runSeoChecks(input: {
  siteTitle?: string | null;
  siteDescription?: string | null;
  pages: Array<{ id: string; title?: string | null; seoTitle?: string | null; seoDescription?: string | null; noindex?: boolean; isHidden?: boolean; isHome?: boolean; path?: string }>;
  allowIndexing?: boolean;
  sitemapCheckedAt?: string | null;
  googleSearchConsoleConfirmed?: boolean;
}): SeoCheck[] {
  const checks: SeoCheck[] = [];
  checks.push({
    id: "site_title",
    title: "Website title set",
    status: input.siteTitle ? "ok" : "bad",
    fixHref: "search",
  });
  checks.push({
    id: "site_desc",
    title: "Website description set",
    status: input.siteDescription ? "ok" : "bad",
    fixHref: "search",
  });
  let missing = 0;
  for (const p of input.pages) {
    if (p.isHidden) continue;
    if (!p.seoTitle && !p.title) missing++;
  }
  checks.push({
    id: "pages_title",
    title: "Pages have titles",
    status: missing === 0 ? "ok" : "bad",
    detail: missing > 0 ? `${missing} pages missing a title` : undefined,
    fixHref: "search",
  });
  checks.push({
    id: "indexing",
    title: "Search engines allowed",
    status: input.allowIndexing !== false ? "ok" : "warn",
    fixHref: "search",
  });
  checks.push({
    id: "sitemap",
    title: "Sitemap checked recently",
    status: input.sitemapCheckedAt ? "ok" : "tip",
    fixHref: "sitemap",
  });
  checks.push({
    id: "gsc",
    title: "Search Console confirmed",
    status: input.googleSearchConsoleConfirmed ? "ok" : "tip",
    fixHref: "sitemap",
  });
  return checks;
}

export function scoreSeoChecks(checks: SeoCheck[]) {
  const total = checks.length;
  const passed = checks.filter((c) => c.status === "ok").length;
  return { passed, total, pct: total === 0 ? 0 : Math.round((passed / total) * 100) };
}
