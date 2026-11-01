import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api",
        "/p/",
        "/e/",
        "/invite/",
        "/transfer/",
        "/billing/",
        "/email/",
        "/security/",
        "/reset-password",
        "/forgot-password",
        "/verify-email",
        "/login/verify",
        "/mfa",
        "/mfa/setup",
        "/onboarding/",
        "/confirm-recipient",
        "/templates/[slug]/preview/",
        "/frame/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}