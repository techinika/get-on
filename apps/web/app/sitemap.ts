import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    "",
    "/request-demo",
    "/signup",
    "/login",
    "/terms",
    "/privacy",
    "/cookies",
    "/acceptable-use",
    "/templates",
    "/templates/category/software",
    "/templates/category/law-firm",
    "/templates/category/restaurant",
    "/templates/category/developer-portfolio",
    "/templates/category/software-company",
    "/billing-policy",
    "/report",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
}