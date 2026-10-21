import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    "",
    "/request-demo",
    "/signup",
    "/login",
    "/forgot-password",
    "/terms",
    "/privacy",
    "/cookies",
    "/acceptable-use",
  ].map((path) => ({
    url: `${base}${path}`,
  }));
}
