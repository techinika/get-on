import { describe, expect, it } from "vitest";
import { parseDesign, restyleDesign, type CurrentLook } from "@get-on/ai";
import {
  applyDesignPrefs,
  applyDesignPrefsAsDefaults,
  designPrefsToText,
  mergeDesignInterpretation,
  parseDesignPrefs,
} from "@/lib/ai/design-prefs";
import { designInterpretationSchema } from "@/lib/ai/design-schema";

describe("design preferences", () => {
  it("keeps only known values and caps style words", () => {
    const prefs = parseDesignPrefs({
      styles: ["Modern", "Minimal", "Bold", "Warm", "Unknown"],
      primary: "#112233",
      accent: "red",
      background: "dark",
      fontFeel: "elegant",
      fontName: "Fraunces",
      hero: "split",
      density: "airy",
      corners: "round",
      buttonShape: "pill",
      include: ["Pricing", "Nope"],
      exclude: ["Team"],
    });

    expect(prefs.styles).toEqual(["Modern", "Minimal", "Bold"]);
    expect(prefs.primary).toBe("#112233");
    expect(prefs.accent).toBeNull();
    expect(prefs.background).toBe("dark");
    expect(prefs.include).toEqual(["Pricing"]);
    expect(prefs.exclude).toEqual(["Team"]);
  });

  it("turns preferences into plain-language instructions", () => {
    const prefs = parseDesignPrefs({
      styles: ["Warm"],
      primary: "#abcdef",
      background: "light",
      fontFeel: "friendly",
      hero: "centered",
      include: ["Services"],
    });

    const text = designPrefsToText(prefs);
    expect(text).toContain("Main colour #abcdef");
    expect(text).toContain("friendly fonts");
    expect(text).toContain("centered hero");
    expect(text).toContain("Include Services");
  });

  it("lets an explicit preference override an inferred value", () => {
    const spec = parseDesign("Modern look with a blue hero.");
    applyDesignPrefs(
      spec,
      parseDesignPrefs({
        primary: "#123456",
        hero: "centered",
        corners: "round",
      }),
    );

    expect(spec.palette.primary).toBe("#123456");
    expect(spec.layout.hero).toBe("centered");
    expect(spec.layout.corners).toBe("round");
  });

  it("uses saved preferences as defaults without replacing explicit requests", () => {
    const spec = parseDesign(
      "Use #ff0000 as the main colour, a centered hero and a light background.",
    );
    applyDesignPrefsAsDefaults(
      spec,
      parseDesignPrefs({
        primary: "#123456",
        hero: "split",
        background: "dark",
        fontFeel: "elegant",
        include: ["Pricing"],
      }),
    );

    expect(spec.palette.primary).toBe("#ff0000");
    expect(spec.layout.hero).toBe("centered");
    expect(spec.palette.mode).toBe("light");
    expect(spec.fonts.feel).toBe("elegant");
    expect(spec.sections.include).toContain("pricing");
  });

  it("fills missing spec fields from the model without replacing clear requests", () => {
    const spec = parseDesign("Use #ff0000 as the main colour.");
    const interpretation = designInterpretationSchema.parse({
      requirements: [
        {
          kind: "font_feel",
          target: "fonts",
          value: "elegant",
          strength: "should",
        },
      ],
      palette: { primary: "#0000ff", mode: "dark" },
      fonts: { feel: "elegant", heading: "Fraunces" },
      confidence: 0.8,
    });

    const merged = mergeDesignInterpretation(spec, interpretation);

    expect(merged.palette.primary).toBe("#ff0000");
    expect(merged.palette.mode).toBe("dark");
    expect(merged.fonts.feel).toBe("elegant");
    expect(merged.fonts.heading?.id).toBe("Fraunces");
    expect(merged.requirements.some((item) => item.kind === "font_feel")).toBe(true);
  });
});

describe("restyle with an interpreted spec", () => {
  it("changes the look only and keeps page content", () => {
    const current: CurrentLook = {
      theme: {
        corners: "soft",
        colors: {
          primary: "#0f766e",
          accent: "#f59e0b",
          background: "#ffffff",
          text: "#111827",
          soft: "#f3f4f6",
        },
        colorMode: "light",
        fonts: {
          heading: { id: "Manrope", weight: 700 },
          body: { id: "Inter", weight: 400 },
          scale: "comfortable",
        },
      },
      heroLayout: "split",
      heroProps: { layout: "split" },
      sectionPlan: [{ type: "hero", source: "template" }],
      pages: ["Home"],
    };

    const spec = parseDesign("Main colour #123456. Airy spacing. Dark background.");
    const result = restyleDesign("Main colour #123456. Airy spacing. Dark background.", current, {}, {}, spec);

    expect(result.contentChanged).toBe(false);
    expect(result.decision.theme.colors?.primary).toBe("#123456");
    expect(result.decision.theme.density).toBe("airy");
    expect(result.decision.sectionPlan).toEqual(current.sectionPlan);
    expect(result.decision.pages).toEqual(["Home"]);
    expect(result.changes.some((item) => item.area === "colour primary")).toBe(true);
  });
});
