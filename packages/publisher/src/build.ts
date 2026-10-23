import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { buildCss } from "./css";
import { prepareFonts } from "./fonts";
import { renderHtml, renderNotFoundHtml, renderFormStatusHtml, type NavItem } from "./html";
import { prepareImages, type PreparedImage } from "./images";
import { hashBytes, slugify } from "./hash";
import type { BuildSiteInput, BuildSiteResult, BuiltFile } from "./types";

export * from "./types";
export { prepareFonts } from "./fonts";
export { prepareImages } from "./images";
export { buildCss, minifyCss } from "./css";
export { renderHtml, renderNotFoundHtml } from "./html";
export { pageSeo } from "./seo";

const CSS_BUDGET_BYTES = 14 * 1024;
const PAGE_BUDGET_BYTES = 20 * 1024;

/** Reads the stylesheet of the renderer from the package. */
export function readRendererCss(): string {
  try {
    const require = createRequire(import.meta.url);
    const packageJson = require.resolve("@get-on/renderer/package.json");
    const cssPath = path.join(
      path.dirname(packageJson),
      "styles",
      "renderer.css",
    );
    return readFileSync(cssPath, "utf8");
  } catch {
    return "";
  }
}

function textFile(body: string): BuiltFile {
  const bytes = new TextEncoder().encode(body);
  return {
    body: bytes,
    contentType: "text/html; charset=utf-8",
    size: bytes.byteLength,
  };
}

function xmlFile(body: string): BuiltFile {
  const bytes = new TextEncoder().encode(body);
  return {
    body: bytes,
    contentType: "application/xml; charset=utf-8",
    size: bytes.byteLength,
  };
}

function textPlain(body: string): BuiltFile {
  const bytes = new TextEncoder().encode(body);
  return {
    body: bytes,
    contentType: "text/plain; charset=utf-8",
    size: bytes.byteLength,
  };
}

function gzipSize(bytes: Uint8Array): number {
  return gzipSync(Buffer.from(bytes)).byteLength;
}

/** The address of a page inside the website. */
export function pagePath(slug: string): string {
  const clean = slugify(slug);
  return clean === "" ? "index.html" : `${clean}/index.html`;
}

/** The address of a page on the web. */
export function pageUrl(baseUrl: string, slug: string): string {
  const clean = slugify(slug);
  return clean === "" ? baseUrl : `${baseUrl}/${clean}`;
}

/**
 * Builds the whole website as plain files. Nothing here touches the network
 * or the database, so the same input always gives the same output.
 */
export async function buildSite(
  input: BuildSiteInput,
): Promise<BuildSiteResult> {
  const warnings: string[] = [];
  const rootDomain = input.rootDomain ?? "get-on.tech";
  const baseUrl = `https://${input.subdomain}.${rootDomain}`;

  const fonts = prepareFonts(input.fonts ?? []);
  const images = await prepareImages(input.images ?? []);
  warnings.push(...images.warnings);

  const rendererCss = input.css ?? readRendererCss();
  const css = buildCss({
    theme: input.settings.theme,
    rendererCss,
    fonts: fonts.fonts,
  });

  const cssGzip = gzipSize(new TextEncoder().encode(css));
  if (cssGzip > CSS_BUDGET_BYTES) {
    warnings.push(
      "The stylesheet of your website is larger than we like. It may load slowly.",
    );
  }

  const files: Record<string, BuiltFile> = {};
  Object.assign(files, images.files);

  const formsEnabled = input.forms?.enabled === true;
  const visiblePages = input.pages.filter((page) => !page.hidden);
  if (
    !formsEnabled &&
    visiblePages.some((page) =>
      page.blocks.some(
        (block) =>
          typeof block === "object" &&
          block !== null &&
          (block as { type?: string }).type === "contact-form",
      ),
    )
  ) {
    warnings.push(
      "Your contact form is turned off, so visitors cannot send you messages.",
    );
  }
  const nav: NavItem[] = visiblePages
    .filter((page) => page.showInMenu !== false && page.slug !== "")
    .map((page) => ({
      label: page.title,
      href: `/${slugify(page.slug)}`,
      pageId: page.id,
    }));

  const logo = await buildLogo(input, files);
  const ogImage = await buildOgImage(input, files, logo.url);

  if (!logo.url) {
    files["favicon.svg"] = {
      body: new TextEncoder().encode(faviconSvg(input)),
      contentType: "image/svg+xml",
      size: Buffer.byteLength(faviconSvg(input)),
    };
  }

  const preparedImages = new Map<string, PreparedImage>();
  for (const [id, image] of images.images) preparedImages.set(id, image);

  let largestPageBytes = 0;

  const forms = collectForms(input);
  // Defuse any brace pairs a visitor typed, so their text can never become a
  // placeholder. Form block ids are read before this, so forms still work.
  const safePages = visiblePages.map((page) => ({
    ...page,
    blocks: defuseBraces(page.blocks) as unknown[],
  }));

  for (const page of safePages) {
    const canonical = pageUrl(baseUrl, page.slug);
    const html = renderHtml({
      settings: input.settings,
      page,
      canonical,
      css,
      nav,
      images: preparedImages,
      logoUrl: logo.url,
      ogImageUrl: ogImage.url,
      contactEnabled: formsEnabled,
      pagePath: page.slug === "" ? "/" : `/${slugify(page.slug)}`,
    });
    const file = textFile(html);
    files[pagePath(page.slug)] = file;

    const gzipped = gzipSize(file.body);
    if (gzipped > largestPageBytes) largestPageBytes = gzipped;
    if (gzipped > PAGE_BUDGET_BYTES) {
      warnings.push(
        `The page "${page.title}" is larger than we like. It may load slowly.`,
      );
    }
  }

  // The home page always exists, even when it has no blocks yet.
  if (!files["index.html"]) {
    const home = safePages.find((page) => page.slug === "");
    const html = renderHtml({
      settings: input.settings,
      page: home ?? {
        id: "home",
        slug: "",
        title: input.settings.businessName,
        blocks: [],
      },
      canonical: baseUrl,
      css,
      nav,
      images: preparedImages,
      logoUrl: logo.url,
      ogImageUrl: ogImage.url,
      contactEnabled: formsEnabled,
      pagePath: "/",
    });
    files["index.html"] = textFile(html);
  }

  files["404.html"] = textFile(
    renderNotFoundHtml({ settings: input.settings, css, logoUrl: logo.url }),
  );

  if (formsEnabled) {
    files["_forms/sent/index.html"] = textFile(
      renderFormStatusHtml({
        settings: input.settings,
        css,
        logoUrl: logo.url,
        heading: "Message sent",
        text: "Thank you. We will get back to you as soon as we can.",
        problem: false,
      }),
    );
    files["_forms/problem/index.html"] = textFile(
      renderFormStatusHtml({
        settings: input.settings,
        css,
        logoUrl: logo.url,
        heading: "Message not sent",
        text: "{{GS_PROBLEM_TEXT}}",
        problem: true,
      }),
    );
  }

  files["sitemap.xml"] = xmlFile(buildSitemap(baseUrl, visiblePages));
  files["robots.txt"] = textPlain(
    buildRobots(baseUrl, input.settings.seo?.allowIndexing !== false),
  );

  const shared = fonts.shared;
  const totalBytes =
    Object.values(files).reduce((sum, file) => sum + file.size, 0) +
    Object.values(shared).reduce((sum, file) => sum + file.size, 0);

  return { files, shared, warnings, totalBytes, largestPageBytes, forms };
}

/**
 * Walks a content value and breaks up any `{{` or `}}` in strings with a
 * zero-width space, so text a visitor typed can never match a placeholder.
 */
function defuseBraces(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{/g, "{\u200B{").replace(/\}\}/g, "}\u200B}");
  }
  if (Array.isArray(value)) return value.map(defuseBraces);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = defuseBraces(child);
    return out;
  }
  return value;
}

const FORM_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;

/** Finds the contact form in the pages, so the app can store its address. */
function collectForms(input: BuildSiteInput): BuildSiteResult["forms"] {
  if (input.forms?.enabled !== true) return [];
  const found: BuildSiteResult["forms"] = [];
  for (const page of input.pages) {
    if (page.hidden) continue;
    const pagePath = page.slug === "" ? "/" : `/${slugify(page.slug)}`;
    for (const block of page.blocks) {
      if (!block || typeof block !== "object") continue;
      if ((block as { type?: string }).type !== "contact-form") continue;
      const id = (block as { id?: string }).id;
      if (!id || !FORM_ID_RE.test(id)) continue;
      const props = ((block as { props?: Record<string, unknown> }).props ?? {}) as Record<string, unknown>;
      found.push({
        id,
        pagePath,
        showName:
          props.variation === 'mini' ? props.showName === true : props.showName !== false,
        showPhone: Boolean(props.showPhone),
        phoneRequired: Boolean(props.phoneRequired) && Boolean(props.showPhone),
      });
    }
  }
  return found;
}

function buildSitemap(baseUrl: string, pages: BuildSiteInput["pages"]): string {
  const urls = pages
    .filter((page) => !page.hidden && !page.noindex)
    .map((page) => {
      const loc = pageUrl(baseUrl, page.slug);
      return `  <url><loc>${loc}</loc></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function buildRobots(baseUrl: string, allowIndexing: boolean): string {
  const lines = ["User-agent: *"];
  if (allowIndexing) {
    lines.push("Allow: /");
    lines.push("Disallow: /_forms/");
  } else {
    lines.push("Disallow: /");
  }
  lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/** The logo of the website, made into the sizes a browser asks for. */
async function buildLogo(
  input: BuildSiteInput,
  files: Record<string, BuiltFile>,
): Promise<{ url: string | null }> {
  const logo = input.settings.logo;
  if (!logo?.bytes) return { url: null };

  try {
    const source = Buffer.from(logo.bytes);
    const hash = hashBytes(logo.bytes);
    const base = `assets/logo-${hash}`;

    for (const size of [64, 128, 256]) {
      const body = await sharp(source)
        .resize({
          width: size,
          height: size,
          fit: "cover",
          withoutEnlargement: false,
        })
        .webp({ quality: 80 })
        .toBuffer();
      files[`${base}-${size}.webp`] = {
        body: new Uint8Array(body),
        contentType: "image/webp",
        size: body.byteLength,
      };
    }

    const icon = await sharp(source)
      .resize({ width: 32, height: 32, fit: "cover" })
      .png()
      .toBuffer();
    files["favicon.png"] = {
      body: new Uint8Array(icon),
      contentType: "image/png",
      size: icon.byteLength,
    };

    const touch = await sharp(source)
      .resize({ width: 180, height: 180, fit: "cover" })
      .png()
      .toBuffer();
    files["apple-touch-icon.png"] = {
      body: new Uint8Array(touch),
      contentType: "image/png",
      size: touch.byteLength,
    };

    return { url: `/${base}-128.webp` };
  } catch {
    return { url: null };
  }
}

/** The picture that shows when the website is shared in a chat or a message. */
async function buildOgImage(
  input: BuildSiteInput,
  files: Record<string, BuiltFile>,
  logoUrl: string | null,
): Promise<{ url: string | null }> {
  const palette = input.settings.theme.palette;
  const background =
    palette === "charcoal"
      ? "#111827"
      : palette === "ocean"
        ? "#14202E"
        : "#1F1A17";
  const text = input.settings.businessName;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${background}"/><text x="60" y="330" font-family="Figtree, system-ui, sans-serif" font-size="72" font-weight="700" fill="#FFFFFF">${escapeXml(text)}</text><text x="60" y="400" font-family="Figtree, system-ui, sans-serif" font-size="32" fill="#F5A524">${escapeXml(input.subdomain + "." + (input.rootDomain ?? "get-on.tech"))}</text></svg>`;

  try {
    const body = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toBuffer();
    files["assets/og-image.png"] = {
      body: new Uint8Array(body),
      contentType: "image/png",
      size: body.byteLength,
    };
    return { url: "/assets/og-image.png" };
  } catch {
    return { url: logoUrl };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A small icon with the first letter of the business name. */
function faviconSvg(input: BuildSiteInput): string {
  const letter = escapeXml(
    input.settings.businessName.slice(0, 1).toUpperCase() || "G",
  );
  const colour =
    input.settings.theme.palette === "ocean" ? "#1D5FA8" : "#0B6B4F";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colour}"/><text x="32" y="44" font-family="system-ui, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#FFFFFF">${letter}</text></svg>`;
}
