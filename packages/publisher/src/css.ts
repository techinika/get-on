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
