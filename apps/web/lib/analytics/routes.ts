/**
 * Analytics route policy - single source of truth for which routes may load
 * Google Analytics (GTAG). Routes not on the allowed list never load Google
 * scripts, never send page views, and do not reference any Google domains.
 *
 * New routes default to NOT allowed unless explicitly added below.
 */
export const ANALYTICS_ALLOWED_ROUTES = new Set([
  "/",
  "/templates",
  "/templates/[slug]",
  "/templates/category/[category]",
  "/pricing",
  "/request-demo",
  "/signup",
  "/login",
  "/terms",
  "/privacy",
  "/cookies",
  "/acceptable-use",
  "/billing-policy",
  "/report",
]);

/**
 * Check if a pathname is allowed for Google Analytics.
 * This is the authoritative check; never trust the client to know.
 */
export function isAnalyticsRoute(pathname: string): boolean {
  // Normalize: strip trailing slash for comparison
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return ANALYTICS_ALLOWED_ROUTES.has(normalized);
}

/**
 * Extract a simple slug from a path like /templates/[slug] or /templates/category/[category].
 * Used for matching pattern routes.
 */
export function extractSlug(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "").trim();
  if (normalized === "/") return null;

  const parts = normalized.split("/").filter((p) => p.length > 0);

  // /templates/[slug]
  if (parts[0] === "template" || parts[0] === "templates") {
    if (parts.length >= 2) return parts[1];
  }

  // /templates/category/[category]
  if (parts[0] === "templates" && parts[1] === "category") {
    if (parts.length >= 3) return parts[2];
  }

  return null;
}

/**
 * Gets the canonical base URL for the site, used in CSP and sitemap.
 * Falls back to the environment variable or localhost.
 */
export function getBaseUrl(): string {
  return typeof window !== "undefined"
    ? (window.__BASE_URL__ || "http://localhost:3000")
    : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}