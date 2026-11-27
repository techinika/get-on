import { describe, expect, it } from "vitest";
import { lintLayout, themeGoogleFontsUrl, themeTokens } from "@get-on/blocks";
import { SYSTEM_TEMPLATES, materializeTemplate, validateTemplatePackage } from "@get-on/templates";

const expected = {
  starter: { hero: "offset-frame", header: "classic", font: "Bricolage Grotesque", rhythm: "even", palette: "fresh-green" },
  "software-company": { hero: "product-shot", header: "split", font: "Space Grotesk", rhythm: "bold", palette: "pulse" },
  "law-firm": { hero: "statement", header: "centered", font: "Libre Caslon Text", rhythm: "tinted", palette: "meridian" },
  restaurant: { hero: "fullbleed", header: "overlay", font: "DM Serif Display", rhythm: "alternate", palette: "ember" },
  "developer-portfolio": { hero: "minimal", header: "minimal", font: "Anton", rhythm: "bold", palette: "concrete" },
  "salon-beauty": { hero: "arch", header: "centered", font: "Fraunces", rhythm: "alternate", palette: "willow" },
  "boutique-shop": { hero: "card-over-image", header: "split", font: "Bodoni Moda", rhythm: "tinted", palette: "bloom" },
  "home-services": { hero: "split", header: "classic", font: "Poppins", rhythm: "even", palette: "clearview" },
  "community-church": { hero: "centered", header: "classic", font: "Baloo 2", rhythm: "alternate", palette: "sprout" },
  "creative-studio": { hero: "editorial", header: "minimal", font: "Cormorant Garamond", rhythm: "even", palette: "frame" },
} as const;

function shape(pkg: (typeof SYSTEM_TEMPLATES)[number]) {
  const composition = pkg.compositions[0]!;
  const hero = composition.pages[0]!.blocks.find((block) => block.type === "hero");
  return {
    hero: String(hero?.props?.layout ?? ""),
    header: String(composition.theme.header?.style ?? ""),
    font: composition.theme.fonts?.heading.id ?? "",
    rhythm: String(composition.theme.design?.rhythm ?? ""),
    palette: String(composition.theme.palette ?? ""),
  };
}

describe("template distinctness", () => {
  it("matches the design matrix for all ten templates", () => {
    expect(SYSTEM_TEMPLATES).toHaveLength(10);
    for (const pkg of SYSTEM_TEMPLATES) {
      expect(validateTemplatePackage(pkg).ok, pkg.meta.slug).toBe(true);
      expect(shape(pkg), pkg.meta.slug).toEqual(expected[pkg.meta.slug as keyof typeof expected]);
      expect(pkg.compositions[0]!.pages.length, pkg.meta.slug).toBeGreaterThanOrEqual(4);
      expect(pkg.compositions[0]!.pages.length, pkg.meta.slug).toBeLessThanOrEqual(6);

      const comp = pkg.compositions[0]!;
      const layoutCheck = lintLayout({
        theme: comp.theme,
        blocks: comp.pages[0]!.blocks,
      });
      expect(layoutCheck.ok, `${pkg.meta.slug}: ${layoutCheck.errors.map((e) => e.message).join("; ")}`).toBe(true);
      expect(themeGoogleFontsUrl(comp.theme)).toContain("https://fonts.googleapis.com/css2?");
      expect(themeTokens(comp.theme)["--s-bg"]).toBeTruthy();
    }
  });

  it("gives every template its own hero, font, palette and overall look", () => {
    const heroes = new Set<string>();
    const fonts = new Set<string>();
    const palettes = new Set<string>();
    const looks = new Set<string>();
    for (const pkg of SYSTEM_TEMPLATES) {
      const current = shape(pkg);
      expect(heroes.has(current.hero), `${pkg.meta.slug} repeats a hero`).toBe(false);
      expect(fonts.has(current.font), `${pkg.meta.slug} repeats a font`).toBe(false);
      expect(palettes.has(current.palette), `${pkg.meta.slug} repeats a palette`).toBe(false);
      const key = `${current.hero}|${current.header}|${current.font}|${current.rhythm}|${current.palette}`;
      expect(looks.has(key), `${pkg.meta.slug} repeats a whole look`).toBe(false);
      heroes.add(current.hero);
      fonts.add(current.font);
      palettes.add(current.palette);
      looks.add(key);
    }
  });

  it("keeps the ten starter designs different from each other", () => {
    const starter = SYSTEM_TEMPLATES.find((pkg) => pkg.meta.slug === "starter")!;
    expect(starter.compositions).toHaveLength(10);
    const fonts = new Set<string>();
    const looks = new Set<string>();
    for (const composition of starter.compositions) {
      const hero = composition.pages[0]!.blocks.find((block) => block.type === "hero");
      const heroLayout = String(hero?.props?.layout ?? "");
      const font = composition.theme.fonts?.heading.id ?? "";
      const look = `${heroLayout}|${composition.theme.header?.style ?? ""}|${font}|${composition.theme.design?.rhythm ?? ""}`;
      expect(fonts.has(font), `${composition.id} repeats a font`).toBe(false);
      expect(looks.has(look), `${composition.id} repeats a whole look`).toBe(false);
      fonts.add(font);
      looks.add(look);
      const result = materializeTemplate(starter, {
        compositionId: composition.id,
        profile: { businessName: "Maple Street Studio" },
      });
      expect(result.pages).toHaveLength(4);
      expect(new Set(result.pages.flatMap((page) => page.blocks.map((block) => block.type))).size).toBeGreaterThanOrEqual(4);
    }
  });
});
