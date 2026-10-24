export type SeoCheck = {
  id: string;
  title: string;
  status: "ok" | "warn" | "missing" | "tip";
  detail?: string;
  fixHref?: string;
};

export function runSeoChecks(input: Record<string, unknown>): SeoCheck[] {
  const checks: SeoCheck[] = [];
  const siteTitle = String(input.siteTitle || "").trim();
  const siteDescription = String(input.siteDescription || "").trim();
  checks.push({
    id: "site_title",
    title: "Website title is set",
    status: siteTitle ? "ok" : "missing",
    detail: siteTitle ? undefined : "Add a website title in Search appearance.",
    fixHref: "search",
  });
  checks.push({
    id: "site_desc",
    title: "Website description is set",
    status: siteDescription ? "ok" : "missing",
    detail: siteDescription ? undefined : "Add a website description in Search appearance.",
    fixHref: "search",
  });
  const allowIndexing = input.allowIndexing !== false;
  checks.push({
    id: "indexing",
    title: "Search engines can find your website",
    status: allowIndexing ? "ok" : "warn",
    detail: allowIndexing ? undefined : "Indexing is turned off.",
    fixHref: "search",
  });
  const sitemapCheckedAt = input.sitemapCheckedAt;
  checks.push({
    id: "sitemap_checked",
    title: "Sitemap checked recently",
    status: sitemapCheckedAt ? "ok" : "tip",
    detail: sitemapCheckedAt ? undefined : "Run a sitemap check.",
    fixHref: "sitemap",
  });
  const gsc = input.googleSearchConsoleConfirmed;
  checks.push({
    id: "gsc_confirmed",
    title: "Website added to Google Search Console",
    status: gsc ? "ok" : "tip",
    detail: gsc ? undefined : "Add your website to Google.",
    fixHref: "sitemap",
  });
  return checks;
}

export function scoreSeoChecks(checks: SeoCheck[]) {
  const total = checks.length || 1;
  const passed = checks.filter((c) => c.status === "ok").length;
  return { passed, total, percent: Math.round((passed / total) * 100) };
}
