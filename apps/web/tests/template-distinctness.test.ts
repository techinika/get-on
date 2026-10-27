import { describe, expect, it } from "vitest";
import { SYSTEM_TEMPLATES, materializeTemplate, validateTemplatePackage } from "@get-on/templates";

const expected = {
  starter: { hero: "split", header: "classic", font: "Bricolage Grotesque", rhythm: "even" },
  "software-company": { hero: "product-shot", header: "classic", font: "Manrope", rhythm: "bold" },
  "law-firm": { hero: "arch", header: "centered", font: "Libre Baskerville", rhythm: "tinted" },
  restaurant: { hero: "fullbleed", header: "overlay", font: "DM Serif Display", rhythm: "alternate" },
  "developer-portfolio": { hero: "minimal", header: "minimal", font: "JetBrains Mono", rhythm: "even" },
  "salon-beauty": { hero: "offset-frame", header: "centered", font: "Cormorant Garamond", rhythm: "alternate" },
  "boutique-shop": { hero: "card-over-image", header: "split", font: "Fraunces", rhythm: "tinted" },
  "home-services": { hero: "diagonal", header: "classic", font: "Oswald", rhythm: "bold" },
  "community-church": { hero: "centered", header: "classic", font: "Lora", rhythm: "alternate" },
  "creative-studio": { hero: "editorial", header: "classic", font: "Space Grotesk", rhythm: "even" },
} as const;

function shape(pkg: (typeof SYSTEM_TEMPLATES)[number]) {
  const composition = pkg.compositions[0]!;
  const hero = composition.pages[0]!.blocks.find((block) => block.type === "hero");
  return {
    hero: String(hero?.props?.layout ?? ""),
    header: String(composition.theme.header?.style ?? ""),
    font: composition.theme.fonts?.heading.id ?? "",
    rhythm: String(composition.theme.design?.rhythm ?? ""),
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
    }
  });

  it("gives every template its own hero, font and overall look", () => {
    const heroes = new Set<string>();
    const fonts = new Set<string>();
    const looks = new Set<string>();
    for (const pkg of SYSTEM_TEMPLATES) {
      const current = shape(pkg);
      expect(heroes.has(current.hero), `${pkg.meta.slug} repeats a hero`).toBe(false);
      expect(fonts.has(current.font), `${pkg.meta.slug} repeats a font`).toBe(false);
      const key = `${current.hero}|${current.header}|${current.font}|${current.rhythm}`;
      expect(looks.has(key), `${pkg.meta.slug} repeats a whole look`).toBe(false);
      heroes.add(current.hero);
      fonts.add(current.font);
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
