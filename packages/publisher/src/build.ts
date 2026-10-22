import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { buildCss } from "./css";
import { prepareFonts } from "./fonts";
import { renderHtml, renderNotFoundHtml, type NavItem } from "./html";
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

  const visiblePages = input.pages.filter((page) => !page.hidden);
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

  for (const page of visiblePages) {
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
    const home = input.pages.find((page) => page.slug === "");
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
    });
    files["index.html"] = textFile(html);
  }

  files["404.html"] = textFile(
    renderNotFoundHtml({ settings: input.settings, css, logoUrl: logo.url }),
  );

  files["sitemap.xml"] = xmlFile(buildSitemap(baseUrl, visiblePages));
  files["robots.txt"] = textPlain(
    buildRobots(baseUrl, input.settings.seo?.allowIndexing !== false),
  );

  const shared = fonts.shared;
  const totalBytes =
    Object.values(files).reduce((sum, file) => sum + file.size, 0) +
    Object.values(shared).reduce((sum, file) => sum + file.size, 0);

  return { files, shared, warnings, totalBytes, largestPageBytes };
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
