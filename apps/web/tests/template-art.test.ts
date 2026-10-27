import { describe, expect, it } from "vitest";
import { resolveThemeColors } from "@get-on/blocks";
import {
  ART_RECIPES,
  SYSTEM_TEMPLATES,
  artPlanFor,
  renderArt,
  templateArtwork,
} from "@get-on/templates";

const palette = {
  primary: "#0B6B4F",
  accent: "#F59E0B",
  background: "#FFFBF7",
  text: "#1F1A17",
  soft: "#F0F7F4",
};

describe("template artwork", () => {
  it("renders every recipe deterministically without text or remote files", () => {
    for (const recipe of ART_RECIPES) {
      const first = renderArt(recipe, palette, { width: 640, height: 480, seed: "test" });
      const second = renderArt(recipe, palette, { width: 640, height: 480, seed: "test" });
      const other = renderArt(recipe, palette, { width: 640, height: 480, seed: "other" });

      expect(first, recipe).toBe(second);
      expect(first, recipe).not.toBe(other);
      expect(first, recipe).toMatch(/^<svg [^>]*viewBox="0 0 640 480"/);
      expect(first, recipe).not.toMatch(/<text|<foreignObject|<image|href=/i);
      expect(first, recipe).toContain(palette.primary);
      expect(Buffer.byteLength(first), recipe).toBeLessThan(200_000);
    }
  });

  it("gives every template five abstract images with descriptive alt text", () => {
    for (const pkg of SYSTEM_TEMPLATES) {
      const artwork = templateArtwork(
        pkg.meta.slug,
        resolveThemeColors(pkg.compositions[0]!.theme),
      );

      expect(artwork.map((art) => art.kind), pkg.meta.slug).toEqual([
        "hero",
        "section",
        "section",
        "portrait",
        "logo",
      ]);
      expect(new Set(artwork.map((art) => art.key)).size, pkg.meta.slug).toBe(5);
      for (const art of artwork) {
        expect(art.alt.length, art.key).toBeGreaterThan(10);
        expect(art.svg, art.key).toContain(`width="${art.width}" height="${art.height}"`);
      }
    }
  });

  it("keeps the recipe plans on the shared catalogue", () => {
    for (const pkg of SYSTEM_TEMPLATES) {
      const plan = artPlanFor(pkg.meta.slug);
      expect(ART_RECIPES, pkg.meta.slug).toContain(plan.hero);
      expect(ART_RECIPES, pkg.meta.slug).toContain(plan.portrait);
      expect(ART_RECIPES, pkg.meta.slug).toContain(plan.logo);
      for (const recipe of plan.sections) expect(ART_RECIPES).toContain(recipe);
    }
  });
});
