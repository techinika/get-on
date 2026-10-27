import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/design/parse";
import { parseDesignSpec, designSpecSchema } from "../src/design/spec";

describe("design parser", () => {
  it("extracts exact colours and roles", () => {
    const spec = parseDesign("Main colour #1E40AF, accent #F59E0B, warm cream background #FFF8F0");
    expect(spec.palette.primary).toBe("#1e40af");
    expect(spec.palette.accent).toBe("#f59e0b");
    expect(spec.palette.background).toBe("#fff8f0");
    expect(spec.palette.userHex).toEqual(["#1e40af", "#f59e0b", "#fffdd0", "#fff8f0"]);
    expect(spec.requirements.filter((item) => item.kind === "color_exact")).toHaveLength(3);
    expect(spec.requirements[0]).toMatchObject({ target: "primary", strength: "must", source: "user" });
  });

  it("accepts rgb, hsl and friendly colour names", () => {
    const spec = parseDesign("Use rgb(10, 100, 80) as the main colour and sage as the accent.");
    expect(spec.palette.primary).toBe("#0a6450");
    expect(spec.palette.accent).toBe("#9caf88");
  });

  it("detects dark mode and builds a palette from a mood", () => {
    const spec = parseDesign("Dark mode, modern and clean, techy, lots of white space");
    expect(spec.palette.mode).toBe("dark");
    expect(spec.layout.density).toBe("airy");
    expect(spec.fonts.feel).toBe("modern");
    expect(spec.requirements.some((item) => item.kind === "mode")).toBe(true);
  });

  it("maps layout words, sections and pages", () => {
    const spec = parseDesign("Editorial hero with big type, centred header, no testimonials, add pricing and gallery, five pages, include an FAQ");
    expect(spec.layout.hero).toBe("editorial");
    expect(spec.layout.header).toBe("centered");
    expect(spec.sections.exclude).toContain("testimonials");
    expect(spec.sections.include).toContain("pricing");
    expect(spec.sections.include).toContain("gallery");
    expect(spec.sections.include).toContain("faq");
    expect(spec.pages.count).toBe(5);
  });

  it("finds named fonts and feelings", () => {
    const spec = parseDesign("Use Libre Baskerville headings with a friendly feel");
    expect(spec.fonts.heading?.id).toBe("Libre Baskerville");
    expect(spec.fonts.feel).toBe("friendly");
    expect(spec.requirements.some((item) => item.kind === "font_exact")).toBe(true);
  });

  it("records unsupported requests with a nearest alternative", () => {
    const spec = parseDesign("I want a video background with parallax and custom code");
    expect(spec.unsupported.map((item) => item.text)).toEqual(["video background", "parallax", "custom code"]);
    expect(spec.unsupported.every((item) => Boolean(item.nearest))).toBe(true);
  });

  it("detects non-English input", () => {
    expect(parseDesign("Bonjour, je voudrais une page moderne avec une couleur verte et sans avis").language).toBe("fr");
    expect(parseDesign("Hola, quiero una página moderna con color verde y sin reseñas").language).toBe("es");
  });

  it("validates and normalises the final spec", () => {
    const spec = parseDesign("Main colour #123 and accent #ff8800");
    expect(designSpecSchema.parse(spec).version).toBe(1);
    expect(parseDesignSpec(JSON.parse(JSON.stringify(spec))).rawText).toContain("#123");
  });
});
