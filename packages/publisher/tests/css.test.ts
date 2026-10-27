import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RENDERER_CSS, RENDERER_CSS_VERSION } from "@get-on/renderer";
import {
  assertStyledCss,
  assertStyledHtml,
  buildCss,
  readRendererCss,
} from "../index";

describe("renderer stylesheet", () => {
  it("is embedded in the renderer package and matches the source file", () => {
    const source = readFileSync(
      path.join(process.cwd(), "..", "renderer", "styles", "renderer.css"),
      "utf8",
    );
    expect(RENDERER_CSS).toBe(source);
    expect(readRendererCss()).toBe(source);
    expect(RENDERER_CSS_VERSION).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is present in the built page and marked for checks", () => {
    const css = buildCss({
      theme: { palette: "fresh-green", fontPair: "friendly", corners: "soft" },
      rendererCss: readRendererCss(),
      fonts: [],
    });
    expect(css).toContain(".gs-header{");
    expect(css).toContain("--s-primary:");
    expect(() => assertStyledCss(css)).not.toThrow();
    expect(() =>
      assertStyledHtml(
        `<html><head><style data-gs="1">${css}</style></head></html>`,
      ),
    ).not.toThrow();
  });

  it("rejects a page with missing or unmarked styles", () => {
    expect(() => assertStyledCss("")).toThrow("CSS_MISSING");
    expect(() =>
      assertStyledCss(".gs-root{--s-primary:#000}.gs-header{}.gs-btn{}"),
    ).toThrow("CSS_INCOMPLETE");
    expect(() => assertStyledHtml("<html><body>Hello</body></html>")).toThrow(
      "HTML_STYLE_MISSING",
    );
    expect(() =>
      assertStyledHtml(
        "<html><head><style>.gs-root{--s-primary:#000}.gs-header{}.gs-section{}.gs-btn{}</style></head></html>",
      ),
    ).toThrow("HTML_STYLE_UNMARKED");
  });
});
