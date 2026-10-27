import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/design/parse";
import { resolveDesign } from "../src/design/resolve";

describe("design resolver", () => {
  it("honours exact colours and a named font", () => {
    const spec = parseDesign("Main colour #1E40AF, accent #F59E0B, Libre Baskerville headings, dark mode");
    const decision = resolveDesign(spec, { businessType: "consultant" });
    expect(decision.theme.colors?.primary).toBe("#1e40af");
    expect(decision.theme.colors?.accent).toBe("#f59e0b");
    expect(decision.theme.fonts?.heading.id).toBe("Libre Baskerville");
    expect(decision.theme.colorMode).toBe("dark");
    expect(decision.report.accuracy).toBeGreaterThan(0.9);
  });

  it("chooses an archetype from the business type and keeps its look", () => {
    const spec = parseDesign("A warm restaurant website");
    const decision = resolveDesign(spec, { businessType: "restaurant" });
    expect(decision.archetype).toBe("restaurant");
    expect(decision.heroLayout).toBe("fullbleed");
    expect(decision.theme.header?.style).toBe("overlay");
  });

  it("applies layout, section and page requirements", () => {
    const spec = parseDesign("Editorial hero, minimal header, no testimonials, add pricing, three pages");
    const decision = resolveDesign(spec, { businessType: "consultant" }, { planId: "basic", maxPages: 5 });
    expect(decision.heroLayout).toBe("editorial");
    expect(decision.theme.header?.style).toBe("minimal");
    expect(decision.sectionPlan.some((item) => item.type === "testimonials")).toBe(false);
    expect(decision.sectionPlan.some((item) => item.type === "pricing")).toBe(true);
    expect(decision.pages).toHaveLength(3);
    expect(decision.report.unmet).toHaveLength(0);
  });

  it("reports a page count the plan cannot meet", () => {
    const spec = parseDesign("ten pages, clean and modern");
    const decision = resolveDesign(spec, {}, { planId: "free", maxPages: 1 });
    expect(decision.pages).toHaveLength(1);
    expect(decision.report.unmet.some((item) => item.requirementId.includes("page_count"))).toBe(true);
    expect(decision.report.accuracy).toBeLessThan(1);
  });

  it("keeps user colours when contrast fails and reports it", () => {
    const spec = parseDesign("background #FFFFFF and text #EEEEEE");
    const decision = resolveDesign(spec);
    expect(decision.theme.colors?.background).toBe("#ffffff");
    expect(decision.theme.colors?.text).toBe("#eeeeee");
    expect(decision.report.unmet.length).toBe(1);
  });

  it("does not count a failed contrast twice when the user asked for it", () => {
    const spec = parseDesign("background #FFFFFF, text #EEEEEE, main colour #1E40AF");
    spec.requirements.push({
      id: "contrast_ok:manual",
      kind: "contrast_ok",
      target: "palette",
      value: true,
      strength: "must",
      source: "user",
    });
    const decision = resolveDesign(spec);
    expect(decision.report.unmet).toHaveLength(1);
    expect(decision.report.unmet[0]?.requirementId).toBe("contrast_ok:manual");
    expect(decision.report.accuracy).toBeCloseTo(0.75);
  });

  it("reports contrast failures on soft sections too", () => {
    const spec = parseDesign("background #FFFFFF, text #333333, soft #555555");
    const decision = resolveDesign(spec);
    expect(decision.report.unmet).toHaveLength(1);
    expect(decision.report.unmet[0]?.requirementId).toBe("contrast_ok:palette");
    expect(decision.report.accuracy).toBeCloseTo(0.75);
  });

  it("applies the requested section order after the hero", () => {
    const spec = parseDesign("pricing then gallery then faq");
    const decision = resolveDesign(spec, { businessType: "restaurant" }, { planId: "basic", maxPages: 5 });
    const types = decision.sectionPlan.map((item) => item.type);
    expect(types[0]).toBe("hero");
    expect(types.indexOf("pricing")).toBeGreaterThan(0);
    expect(types.indexOf("pricing")).toBeLessThan(types.indexOf("gallery"));
    expect(types.indexOf("gallery")).toBeLessThan(types.indexOf("faq"));
    expect(decision.report.unmet).toHaveLength(0);
  });

  it("keeps an explicitly requested page when the plan has to trim pages", () => {
    const spec = parseDesign("add a gallery page and three pages");
    const decision = resolveDesign(spec, { businessType: "restaurant" }, { planId: "basic", maxPages: 5 });
    expect(decision.pages).toHaveLength(3);
    expect(decision.pages[0]).toBe("home");
    expect(decision.pages).toContain("gallery");
    expect(decision.report.unmet).toHaveLength(0);
  });

  it("only uses an overlay header with a compatible hero and reports the mismatch", () => {
    const spec = parseDesign("transparent header, editorial hero");
    const decision = resolveDesign(spec, { businessType: "restaurant" });
    expect(decision.heroLayout).toBe("editorial");
    expect(decision.theme.header?.style).toBe("classic");
    expect(decision.report.unmet.map((item) => item.requirementId)).toContain("header_style:site");
  });

  it("is deterministic for the same request and seed", () => {
    const spec = parseDesign("modern clean website with a split hero and green accents");
    const first = resolveDesign(spec, { teamId: "team", requestId: "request" });
    const second = resolveDesign(spec, { teamId: "team", requestId: "request" });
    expect(first.archetype).toBe(second.archetype);
    expect(first.theme).toEqual(second.theme);
  });
});
