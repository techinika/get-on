import { themeTokens } from "@get-on/blocks";

/**
 * Removes the spaces that are not needed. The rules below are the only ones
 * we write ourselves, so a careful tidy up is enough.
 */
export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s+!important/g, "!important")
    .trim();
}

/** The colour and shape tokens of the site, scoped to the site root. */
export function tokenCss(theme: Parameters<typeof themeTokens>[0]): string {
  const tokens = themeTokens(theme);
  const body = Object.entries(tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return `.gs-root{${body}}`;
}

/** The font faces of the self hosted fonts. */
export function fontFaceCss(
  fonts: { family: string; weight: number; style: string; fileName: string }[],
): string {
  return fonts
    .map(
      (font) =>
        `@font-face{font-family:'${font.family}';font-style:${font.style};font-weight:${font.weight};font-display:swap;src:url('/fonts/${font.fileName}') format('woff2')}`,
    )
    .join("");
}

/** The stylesheet of one page. */
export function buildCss(options: {
  theme: Parameters<typeof themeTokens>[0];
  rendererCss: string;
  fonts: { family: string; weight: number; style: string; fileName: string }[];
}): string {
  const parts = [
    tokenCss(options.theme),
    fontFaceCss(options.fonts),
    options.rendererCss,
  ];
  return minifyCss(parts.filter(Boolean).join("\n"));
}

const REQUIRED_CSS_MARKERS = [
  ".gs-root{",
  "--s-primary:",
  ".gs-header{",
  ".gs-section{",
  ".gs-btn{",
] as const;

/** Stops a publish when the renderer stylesheet was not included. */
export function assertStyledCss(css: string): void {
  if (!css.trim()) throw new Error("CSS_MISSING");
  const compact = css.replace(/\s+/g, "");
  for (const marker of REQUIRED_CSS_MARKERS) {
    if (!compact.includes(marker)) throw new Error("CSS_INCOMPLETE");
  }
}

/** Stops a publish when the page has no complete inline stylesheet. */
export function assertStyledHtml(html: string): void {
  const match = /<style\b([^>]*)>([\s\S]*?)<\/style>/i.exec(html);
  if (!match) throw new Error("HTML_STYLE_MISSING");
  if (!/\bdata-gs\b/.test(match[1] ?? "")) throw new Error("HTML_STYLE_UNMARKED");
  assertStyledCss(match[2] ?? "");
}

/**
 * The v5 stylesheet: one cascade order shared by the editor canvas, the
 * preview and the published site. Renderer styles sit in gs-base, theme tokens
 * in gs-theme, compiled node styles in gs-nodes and custom CSS in gs-user.
 */
export function buildLayeredCss(options: {
  theme: Parameters<typeof themeTokens>[0];
  rendererCss: string;
  fonts: { family: string; weight: number; style: string; fileName: string }[];
  pageCss: string;
}): string {
  const parts = [
    "@layer gs-protect,gs-base,gs-theme,gs-nodes,gs-user;",
    fontFaceCss(options.fonts),
    `@layer gs-theme{${tokenCss(options.theme)}}`,
    `@layer gs-base{${options.rendererCss}}`,
    options.pageCss,
  ];
  return minifyCss(parts.filter(Boolean).join("\n"));
}

/** Stops a Free-plan publish when the protected badge is missing. */
export function assertProtectedBadge(html: string): void {
  if (!/data-gs-protect="1"/.test(html)) throw new Error("PROTECTED_BADGE_MISSING");
  if (!/Report this site/.test(html)) throw new Error("PROTECTED_REPORT_MISSING");
}
