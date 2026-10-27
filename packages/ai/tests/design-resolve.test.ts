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

  it("is deterministic for the same request and seed", () => {
    const spec = parseDesign("modern clean website with a split hero and green accents");
    const first = resolveDesign(spec, { teamId: "team", requestId: "request" });
    const second = resolveDesign(spec, { teamId: "team", requestId: "request" });
    expect(first.archetype).toBe(second.archetype);
    expect(first.theme).toEqual(second.theme);
  });
});
