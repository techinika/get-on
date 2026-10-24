import { renderToStaticMarkup } from "react-dom/server.edge";
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
  /** Whether the contact plugin is on for this website. */
  contactEnabled?: boolean;
  /** The exact path this page is served at, for the form back link. */
  pagePath?: string;
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
      content: { schemaVersion: 3, blocks: page.blocks },
      header,
      footer,
      ctx: {
        getPageHref: (pageId: string) =>
          options.nav.find((item) => item.pageId === pageId)?.href ?? "/",
        getImage: (imageId: string) => options.images.get(imageId) ?? null,
        mode: "live",
        contactEnabled: options.contactEnabled !== false,
        pagePath: options.pagePath,
      },
    }) as React.ReactNode,
  );

  const body = neutralizeStrayPlaceholders(renderToStaticMarkup(content));
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

  const twitterSite = settings.seo?.twitterHandle
  ? `\n<meta name="twitter:site" content="${escapeHtml(normaliseHandle(settings.seo.twitterHandle))}">`
  : "";
const themeColor = settings.themeColor
  ? `\n<meta name="theme-color" content="${escapeHtml(settings.themeColor)}">`
  : "";
const googleVerification = settings.verification?.gscTag
  ? `\n<meta name="google-site-verification" content="${escapeHtml(settings.verification.gscTag)}">`
  : "";
const bingVerification = settings.verification?.bing
  ? `\n<meta name="msvalidate.01" content="${escapeHtml(settings.verification.bing)}">`
  : "";
  const descriptionTag = seo.description
    ? `\n<meta name="description" content="${escapeHtml(seo.description)}">`
    : "";
  const ogDescriptionTag = seo.description
    ? `\n<meta property="og:description" content="${escapeHtml(seo.description)}">`
    : "";
  const twitterDescriptionTag = seo.description
    ? `\n<meta name="twitter:description" content="${escapeHtml(seo.description)}">`
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
<meta name="color-scheme" content="light">${themeColor}${googleVerification}${bingVerification}
<title>${escapeHtml(seo.title)}</title>${descriptionTag}
<link rel="canonical" href="${escapeHtml(seo.canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(seo.title)}">${ogDescriptionTag}${ogImage}
<meta property="og:url" content="${escapeHtml(seo.canonical)}">
<meta name="twitter:card" content="summary_large_image">${twitterSite}
<meta name="twitter:title" content="${escapeHtml(seo.title)}">${twitterDescriptionTag}${ogImage}${robotsTag}
<style>${options.css}</style>
<script type="application/ld+json">${jsonLdString(jsonLd)}</script>
</head>
<body>
${body}
</body>
</html>
`;
}

/**
 * The page shown after someone sends a contact form, either the thank-you or
 * the problem page. The text may contain the `{{GS_PROBLEM_TEXT}}` placeholder,
 * which the site server swaps for a plain sentence.
 */
export function renderFormStatusHtml(options: {
  settings: SiteSettings;
  css: string;
  logoUrl?: string | null;
  heading: string;
  text: string;
  problem: boolean;
}): string {
  const { settings } = options;
  const plan = (settings.plan ?? "free").toLowerCase();
  const watermark = settings.showWatermark !== false && plan === "free";

  const body = neutralizeStrayPlaceholders(
    renderToStaticMarkup(
      React.createElement(
        SiteRoot,
        { theme: settings.theme },
        React.createElement(
          "main",
          { className: "gs-status" },
          React.createElement("h1", { className: "gs-status-title" }, options.heading),
          React.createElement("p", { className: "gs-status-text" }, options.text),
          React.createElement(
            "div",
            { className: "gs-btn-wrap" },
            React.createElement(
              "a",
              { className: "gs-btn gs-btn-solid", href: "{{GS_BACK}}" },
              options.problem ? "Try again" : "Back to the site",
            ),
          ),
        ),
        React.createElement(SiteFooter, {
          businessName: settings.businessName,
          showWatermark: watermark,
        }),
      ),
    ),
  );

  return `<!doctype html>
<html lang="en" data-color-mode="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(options.heading)} | ${escapeHtml(settings.businessName)}</title>
<meta name="robots" content="noindex,nofollow">
<style>${options.css}</style>
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
  const title = settings.customNotFound?.title?.trim() || "Page not found";
  const text =
    settings.customNotFound?.text?.trim() ||
    "That page does not exist. It may have been moved or removed.";
  const button =
    settings.customNotFound?.button?.trim() || "Go to the homepage";

  const body = renderToStaticMarkup(
    React.createElement(
      SiteRoot,
      { theme: settings.theme },
      React.createElement(
        "main",
        { className: "gs-404" },
        React.createElement("h1", { className: "gs-404-title" }, title),
        React.createElement("p", { className: "gs-404-text" }, text),
        React.createElement(
          "div",
          { className: "gs-btn-wrap" },
          React.createElement(
            "a",
            { className: "gs-btn gs-btn-solid", href: "/" },
            button,
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
<title>${escapeHtml(title)} | ${escapeHtml(settings.businessName)}</title>
<meta name="robots" content="noindex,nofollow">
<style>${options.css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

const ALLOWED_PLACEHOLDER_RE =
  /\{\{GS_FORM_TOKEN:[A-Za-z0-9_-]{6,32}\}\}|\{\{GS_PAGE_PATH\}\}|\{\{GS_BACK\}\}|\{\{GS_PROBLEM_TEXT\}\}/g;

/**
 * Keeps only the placeholders the platform inserts and defuses any others a
 * visitor might have typed into their content, so user text can never become a
 * placeholder.
 */
function neutralizeStrayPlaceholders(html: string): string {
  const kept: string[] = [];
  const withMarkers = html.replace(ALLOWED_PLACEHOLDER_RE, (match) => {
    kept.push(match);
    return `\u0000GS${kept.length - 1}\u0000`;
  });
  const defused = withMarkers.replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;");
  return defused.replace(/\u0000GS(\d+)\u0000/g, (_m, index) => kept[Number(index)]!);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normaliseHandle(value: string) {
  const handle = value.trim();
  if (!handle) return "";
  return handle.startsWith("@") ? handle : `@${handle}`;
}

function jsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
