import { describe, expect, it } from "vitest";
import { lintLayout, applyLayoutAutofixes } from "@get-on/blocks";

const theme = {
  colors: { primary: "#0B6B4F", accent: "#F59E0B", background: "#FFFFFF", text: "#1F1A17", soft: "#F0F7F4" },
  corners: "soft" as const,
  density: "comfortable" as const,
};

const hero = {
  id: "hero-1",
  type: "hero",
  props: { layout: "split", heading: "A calm and clear website for your small business", subheading: "We help small business owners make a simple website that is easy to update and easy to read.", buttonLabel: "Get in touch" },
  sec: {},
};

describe("layout lint", () => {
  it("passes a clean home page", () => {
    const result = lintLayout({
      theme,
      blocks: [
        hero,
        { id: "features-1", type: "features", props: { layout: "rows", heading: "What we do", items: [{ title: "One" }] } },
        { id: "gallery-1", type: "gallery", props: { layout: "mosaic", images: [{ imageId: "x" }] } },
        { id: "cta-1", type: "cta", props: { layout: "split", heading: "Ready to start?" } },
      ],
    });
    expect(result.errors).toEqual([]);
  });

  it("flags empty pages, missing heroes and edge shapes", () => {
    const result = lintLayout({
      theme,
      blocks: [
        { id: "text-1", type: "text", props: {}, sec: { shape: { top: "wave" } } },
      ],
    });
    expect(result.errors.map((item) => item.id)).toEqual(expect.arrayContaining(["hero_first", "no_empty_sections", "shape_not_on_edges"]));
  });

  it("flags adjacent layouts and offers an autofix", () => {
    const result = lintLayout({
      theme,
      blocks: [
        hero,
        { id: "features-1", type: "features", props: { layout: "rows", items: [{ title: "One" }] } },
        { id: "features-2", type: "features", props: { layout: "rows", items: [{ title: "Two" }] } },
        { id: "cta-1", type: "cta", props: { layout: "split", heading: "Start" } },
      ],
    });
    const issue = result.issues.find((item) => item.id === "no_adjacent_same_layout");
    expect(issue?.autofix?.props.layout).toBe("bento");
    const fixed = applyLayoutAutofixes([hero, { id: "a", type: "features", props: { layout: "rows" } }, { id: "b", type: "features", props: { layout: "rows" } }]);
    expect(fixed[2]?.props?.layout).toBe("bento");
  });

  it("flags letter marks and contrast", () => {
    const result = lintLayout({
      theme: { ...theme, colors: { ...theme.colors, text: "#EEEEEE" } },
      blocks: [hero, { id: "team-1", type: "team", props: { monogram: "R", items: [{ name: "A" }] } }, { id: "cta-1", type: "cta", props: { heading: "Start" } }],
    });
    expect(result.errors.some((item) => item.id === "no_letter_mark")).toBe(true);
    expect(result.errors.some((item) => item.id === "min_contrast")).toBe(true);
  });

  it("checks headline length and button count", () => {
    const result = lintLayout({
      theme,
      blocks: [
        { ...hero, props: { ...hero.props, layout: "editorial", heading: "This headline is far too long for an editorial hero and should be shortened by a lot", button2Label: "Two", button3Label: "Three" } },
        { id: "cta-1", type: "cta", props: { heading: "Start" } },
      ],
    });
    expect(result.errors.some((item) => item.id === "text_within_variant_limits")).toBe(true);
  });
});
