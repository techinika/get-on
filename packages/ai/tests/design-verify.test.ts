import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/design/parse";
import { resolveDesign } from "../src/design/resolve";
import { verifyDesign } from "../src/design/verify";

const copy = {
  text: "Welcome. We help you build a calm, simple website. Book a call and start today.",
  pages: { home: "A friendly studio for small businesses. Contact us to get started." },
};

describe("design verifier", () => {
  it("scores every requirement kind against the resolved design", () => {
    const spec = parseDesign(
      "Main colour #1E40AF, accent #F59E0B, Libre Baskerville headings, dark mode, editorial hero, minimal header, no testimonials, add pricing, three pages, friendly tone",
    );
    const decision = resolveDesign(spec, { businessType: "consultant" }, { planId: "basic", maxPages: 5 });
    const result = verifyDesign(spec, decision, copy);
    expect(result.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(result.items.every((item) => item.status === "met" || item.status === "unsupported")).toBe(true);
    expect(result.unmet).toHaveLength(0);
  });

  it("reports unmet copy and unsupported requests honestly", () => {
    const spec = parseDesign("Mention 'local family run' and avoid 'cheap'. Video background");
    const decision = resolveDesign(spec);
    const result = verifyDesign(spec, decision, { text: "A cheap website for everyone." });
    expect(result.unmet.map((item) => item.requirementId)).toContain("copy_mentions:copy");
    expect(result.unmet.map((item) => item.requirementId)).toContain("copy_avoids:copy");
    expect(result.unsupported.map((item) => item.text)).toEqual(["video background"]);
    expect(result.accuracy).toBeLessThan(1);
  });

  it("checks page counts, sections and contrast", () => {
    const spec = parseDesign("one page, no gallery, background #FFFFFF, text #EEEEEE");
    const decision = resolveDesign(spec, {}, { planId: "free", maxPages: 1 });
    const result = verifyDesign(spec, decision, copy);
    expect(result.items.find((item) => item.requirementId.includes("page_count"))?.status).toBe("met");
    expect(result.items.find((item) => item.requirementId.includes("section_excluded"))?.status).toBe("met");
    expect(result.items.some((item) => item.status === "unmet")).toBe(true);
  });
});
