import { describe, expect, it } from "vitest";
import {
  collectPageDiagnostics,
  preparePageContentForSave,
  sanitizeCustomCss,
} from "@get-on/blocks";
import type { PageContentV5 } from "@get-on/blocks";

function makePage(overrides?: Partial<PageContentV5>): PageContentV5 {
  return {
    schemaVersion: 5,
    root: {
      id: "root",
      type: "container",
      children: [
        {
          id: "hero-1",
          type: "smart",
          props: { kind: "hero", heading: "Hello World", layout: "centered" },
        },
      ],
    },
    ...overrides,
  };
}

describe("page editor forgiving save and diagnostics", () => {
  it("preserves valid custom CSS and @media rules even when another rule has an error", () => {
    const raw = `
      h1 { color: #112233; font-size: 40px; }
      * { margin: 0; }
      .bad { color: red !important; border-color: #222; }
      @media (max-width: 768px) {
        .card { padding: 16px; }
      }
    `;
    const res = sanitizeCustomCss(raw);
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(2);
    expect(res.css).toContain(".gs-root h1{color:#112233;font-size:40px}");
    expect(res.css).toContain(".gs-root .bad{border-color:#222}");
    expect(res.css).toContain("@media (max-width: 768px){.gs-root .card{padding:16px}}");
  });

  it("allows saving pages with invalid CSS or invalid node styles while rejecting broken schema", () => {
    const pageWithErrors = makePage({
      css: ".broken { color: red !important;",
      root: {
        id: "root",
        type: "container",
        styles: {
          base: { display: "invalid-display-mode", color: "#111111" },
        },
        children: [
          {
            id: "hero-1",
            type: "smart",
            props: { kind: "hero", heading: "Saved anyway" },
          },
        ],
      },
    });

    const saved = preparePageContentForSave(pageWithErrors);
    expect(saved.ok).toBe(true);

    const invalidSchema = preparePageContentForSave({
      schemaVersion: 4,
    } as unknown as PageContentV5);
    expect(invalidSchema.ok).toBe(false);
  });

  it("collects CSS, node style, and layout diagnostics accurately", () => {
    const page = makePage({
      css: "* { color: red; }",
      root: {
        id: "root",
        type: "container",
        children: [
          {
            id: "features-1",
            type: "smart",
            props: { kind: "features", heading: "Services" },
            styles: {
              base: { display: "bogus" },
            },
          },
        ],
      },
    });

    const homeDiagnostics = collectPageDiagnostics(page, {
      theme: { palette: "ocean", fontPair: "classic" },
      isHome: true,
    });
    expect(homeDiagnostics.some((d) => d.source === "css")).toBe(true);
    expect(homeDiagnostics.some((d) => d.source === "node" && d.prop === "display")).toBe(true);
    expect(homeDiagnostics.some((d) => d.source === "layout" && d.id.includes("hero_first"))).toBe(
      true,
    );

    const subpageDiagnostics = collectPageDiagnostics(page, {
      theme: { palette: "ocean", fontPair: "classic" },
      isHome: false,
    });
    expect(
      subpageDiagnostics.some((d) => d.source === "layout" && d.id.includes("hero_first")),
    ).toBe(false);
  });
});
