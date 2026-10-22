import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { SiteRoot, SiteHeader, SiteFooter, RenderPage } from "@get-on/renderer";
import { localBusinessJsonLd, pageSeo, webPageJsonLd } from "./seo";
import type { PublishPage, SiteSettings } from "./types";

export type NavItem = {
  label: string;
  href: string;
  pageId?: string;
};

export type HtmlOptions = {
  settings: SiteSettings;
  page: PublishPage;
  canonical: string;
  css: string;
  nav: NavItem[];
  images: Map<
    string,
    {
      src: string;
      srcSet?: string;
      alt?: string;
      width?: number;
      height?: number;
    }
  >;
  logoUrl?: string | null;
  ogImageUrl?: string | null;
};

/** The HTML document with one inline style tag and the JSON-LD data. */
export function renderHtml(options: HtmlOptions): string {
  const { settings, page } = options;
  const seo = pageSeo({
    settings,
    pageTitle: page.title,
    pageDescription: page.description,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    noindex: page.noindex,
    url: options.canonical,
    isHome: page.slug === "",
  });

  const plan = (settings.plan ?? "free").toLowerCase();
  const watermark = settings.showWatermark !== false && plan === "free";

  const header = React.createElement(SiteHeader, {
    businessName: settings.businessName,
    logoUrl: options.logoUrl ?? null,
    nav: options.nav.map(({ label, href }) => ({ label, href })),
    watermark,
  });

  const footer = React.createElement(SiteFooter, {
    businessName: settings.businessName,
    phone: settings.phone ?? undefined,
    email: settings.email ?? undefined,
    address: settings.address ?? undefined,
    nav: options.nav.map(({ label, href }) => ({ label, href })),
    showWatermark: watermark,
  });

  const content = React.createElement(
    SiteRoot,
    { theme: settings.theme },
    React.createElement(RenderPage, {
      content: { schemaVersion: 2, blocks: page.blocks },
      header,
      footer,
      ctx: {
        getPageHref: (pageId: string) =>
          options.nav.find((item) => item.pageId === pageId)?.href ?? "/",
        getImage: (imageId: string) => options.images.get(imageId) ?? null,
      },
    }) as React.ReactNode,
  );

  const body = renderToStaticMarkup(content);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      localBusinessJsonLd({
        settings,
        url: options.canonical,
        image: options.ogImageUrl ?? options.logoUrl ?? undefined,
      }),
      webPageJsonLd({
        title: seo.title,
        description: seo.description,
        url: options.canonical,
        siteName: settings.businessName,
      }),
    ],
  };

  const descriptionTag = seo.description
    ? `\n<meta name="description" content="${escapeHtml(seo.description)}">`
    : "";
  const robotsTag = seo.noindex
    ? `\n<meta name="robots" content="noindex,nofollow">`
    : "";
  const ogImage = options.ogImageUrl
    ? `\n<meta property="og:image" content="${escapeHtml(options.ogImageUrl)}">`
    : "";

  return `<!doctype html>
<html lang="en" data-color-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(seo.title)}</title>${descriptionTag}
<link rel="canonical" href="${escapeHtml(seo.canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(seo.title)}">${descriptionTag}${ogImage}
<meta property="og:url" content="${escapeHtml(seo.canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(seo.title)}">${descriptionTag}${ogImage}${robotsTag}
<style>${options.css}</style>
<script type="application/ld+json">${jsonLdString(jsonLd)}</script>
</head>
<body>
${body}
</body>
</html>
`;
}

/** The page that is shown when a page is missing. */
export function renderNotFoundHtml(options: {
  settings: SiteSettings;
  css: string;
  logoUrl?: string | null;
}): string {
  const { settings } = options;
  const plan = (settings.plan ?? "free").toLowerCase();
  const watermark = settings.showWatermark !== false && plan === "free";

  const body = renderToStaticMarkup(
    React.createElement(
      SiteRoot,
      { theme: settings.theme },
      React.createElement(
        "main",
        { className: "gs-404" },
        React.createElement(
          "h1",
          { className: "gs-404-title" },
          "Page not found",
        ),
        React.createElement(
          "p",
          { className: "gs-404-text" },
          "That page does not exist. It may have been moved or removed.",
        ),
        React.createElement(
          "div",
          { className: "gs-btn-wrap" },
          React.createElement(
            "a",
            { className: "gs-btn gs-btn-solid", href: "/" },
            "Go to the homepage",
          ),
        ),
      ),
      React.createElement(SiteFooter, {
        businessName: settings.businessName,
        phone: settings.phone ?? undefined,
        email: settings.email ?? undefined,
        address: settings.address ?? undefined,
        showWatermark: watermark,
      }),
    ),
  );

  return `<!doctype html>
<html lang="en" data-color-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Page not found | ${escapeHtml(settings.businessName)}</title>
<meta name="robots" content="noindex,nofollow">
<style>${options.css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
