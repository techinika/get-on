import { themeTokens, type Block, type Theme } from "@get-on/blocks";
import { RENDERER_CSS } from "@get-on/renderer";

export type BuiltFile = {
  body: Uint8Array;
  contentType: string;
  size: number;
};

export type PublishImage = {
  id: string;
  filename?: string;
  path?: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  contentType?: string;
  mime?: string | null;
  bytes: Uint8Array;
};

export type SocialLink = {
  network: string;
  url: string;
};

export type SiteSettings = {
  businessName: string;
  tagline?: string;
  locale?: string;
  theme: Theme;
  themeColor?: string | null;
  businessType?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  socialLinks?: SocialLink[];
  logo?: { contentType: string; bytes: Uint8Array } | null;
  plan?: string;
  showWatermark?: boolean;
  verification?: {
    gscTag?: string;
    bing?: string;
    [key: string]: unknown;
  };
  seo?: {
    title?: string;
    description?: string;
    titleFormat?: string;
    twitterHandle?: string;
    allowIndexing?: boolean;
  };
  customNotFound?: {
    title?: string;
    text?: string;
    button?: string;
  } | null;
};

export type PublishPage = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  noindex?: boolean;
  hidden?: boolean;
  showInMenu?: boolean;
  position?: number;
  blocks: Block[] | unknown[];
};

export type BuildSiteInput = {
  siteId: string;
  subdomain?: string;
  publishId: string;
  builtAt?: Date;
  rootDomain?: string;
  primaryHost?: string | null;
  activePlugins?: string[];
  forms?: { enabled: boolean };
  settings: SiteSettings;
  pages: PublishPage[];
  images?: PublishImage[];
};

export function readRendererCss(): string {
  return RENDERER_CSS;
}

export function assertStyledHtml(html: string): void {
  const required = ['data-gs="1"', ".gs-root", ".gs-header", ".gs-section", ".gs-btn"];
  for (const needle of required) {
    if (!html.includes(needle)) {
      throw new Error(`UPLOAD_VERIFY_FAILED: missing ${needle}`);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cssVarsInline(theme: Theme): string {
  return Object.entries(themeTokens(theme))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export function renderHtml(input: {
  settings: SiteSettings;
  page: PublishPage;
  canonical: string;
  css?: string;
  nav: Array<{ label: string; href: string; pageId?: string }>;
  images: Map<string, { src: string; alt?: string }>;
  logoUrl: string | null;
  ogImageUrl: string | null;
  contactEnabled?: boolean;
  pagePath: string;
}): string {
  const css = input.css ?? readRendererCss();
  const title = escapeHtml(input.page.seoTitle || input.page.title || input.settings.businessName);
  const desc = escapeHtml(
    input.page.seoDescription ||
      input.page.description ||
      input.settings.seo?.description ||
      input.settings.tagline ||
      input.settings.businessName,
  );
  const navHtml = input.nav
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
  const blocksHtml = (input.page.blocks as Array<Record<string, unknown>>)
    .map((raw) => {
      const props =
        raw && typeof raw === "object" && raw.props && typeof raw.props === "object"
          ? (raw.props as Record<string, unknown>)
          : {};
      const heading = typeof props.heading === "string" ? props.heading : "";
      const subheading = typeof props.subheading === "string" ? props.subheading : "";
      const text = typeof props.text === "string" ? props.text : "";
      const btn = typeof props.buttonLabel === "string" ? props.buttonLabel : "";
      return `<section class="gs-section"><div class="gs-container">${
        heading ? `<h2>${escapeHtml(heading)}</h2>` : ""
      }${subheading ? `<p>${escapeHtml(subheading)}</p>` : ""}${
        text ? `<p>${escapeHtml(text)}</p>` : ""
      }${btn ? `<p><a class="gs-btn" href="#contact">${escapeHtml(btn)}</a></p>` : ""}</div></section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${escapeHtml(input.canonical)}">
<style data-gs="1">${css}</style>
</head>
<body>
<div class="gs-root" style="${cssVarsInline(input.settings.theme)}">
<header class="gs-header"><div class="gs-container gs-header-inner"><a class="gs-brand" href="/">${escapeHtml(
    input.settings.businessName,
  )}</a><nav class="gs-nav">${navHtml}</nav></div></header>
<main>${blocksHtml}</main>
<footer class="gs-footer"><div class="gs-container"><p>${escapeHtml(
    input.settings.businessName,
  )}</p>${
    input.settings.showWatermark
      ? '<p class="gs-watermark" data-gs-protect="1">Built with Get-On</p>'
      : ""
  }</div></footer>
</div>
</body>
</html>`;
}

export function buildSite(input: BuildSiteInput): {
  files: Record<string, BuiltFile>;
  shared: Record<string, BuiltFile>;
  warnings: string[];
  totalBytes: number;
  forms: string[];
  rendererVersion: number;
  cssHash: string;
  cssBytes: number;
} {
  const encoder = new TextEncoder();
  const files: Record<string, BuiltFile> = {};
  const shared: Record<string, BuiltFile> = {};
  const css = readRendererCss();

  const imageMap = new Map<string, { src: string; alt?: string }>();
  for (const img of input.images ?? []) {
    const ext = (img.mime || img.contentType || "image/webp").includes("png") ? "png" : "webp";
    const filePath = `media/${img.id}.${ext}`;
    files[filePath] = {
      body: img.bytes,
      contentType: img.mime || img.contentType || "image/webp",
      size: img.bytes.byteLength,
    };
    imageMap.set(img.id, { src: `/${filePath}`, alt: img.alt ?? "" });
  }

  let logoUrl: string | null = null;
  if (input.settings.logo) {
    const ext = input.settings.logo.contentType.includes("png") ? "png" : "webp";
    const logoPath = `assets/logo.${ext}`;
    files[logoPath] = {
      body: input.settings.logo.bytes,
      contentType: input.settings.logo.contentType,
      size: input.settings.logo.bytes.byteLength,
    };
    logoUrl = `/${logoPath}`;
  }

  const nav = input.pages
    .filter((p) => !p.hidden && p.showInMenu !== false)
    .map((p) => ({
      label: p.title,
      href: p.slug ? `/${p.slug}` : "/",
      pageId: p.id,
    }));

  const host = input.primaryHost || `${input.siteId}.${input.rootDomain || "get-on.tech"}`;

  for (const page of input.pages) {
    if (page.hidden) continue;
    const cleanSlug = page.slug.replace(/^\/+|\/+$/g, "");
    const outPath = cleanSlug ? `${cleanSlug}/index.html` : "index.html";
    const html = renderHtml({
      settings: input.settings,
      page,
      canonical: `https://${host}${cleanSlug ? `/${cleanSlug}` : "/"}`,
      css,
      nav,
      images: imageMap,
      logoUrl,
      ogImageUrl: null,
      contactEnabled: input.activePlugins?.includes("contact") ?? false,
      pagePath: cleanSlug ? `/${cleanSlug}` : "/",
    });
    const bytes = encoder.encode(html);
    files[outPath] = {
      body: bytes,
      contentType: "text/html; charset=utf-8",
      size: bytes.byteLength,
    };
  }

  const cssBytes = encoder.encode(css).byteLength;
  let cssHashNum = 0x811c9dc5;
  for (let i = 0; i < css.length; i += 1) {
    cssHashNum ^= css.charCodeAt(i);
    cssHashNum = Math.imul(cssHashNum, 0x01000193) >>> 0;
  }
  const cssHash = cssHashNum.toString(16).padStart(8, "0");
  const totalBytes = Object.values(files).reduce((sum, f) => sum + f.size, 0);
  return {
    files,
    shared,
    warnings: [],
    totalBytes,
    forms: [],
    rendererVersion: 5,
    cssHash,
    cssBytes,
  };
}
