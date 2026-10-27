import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/design/parse";
import { resolveDesign } from "../src/design/resolve";
import { repairDesign } from "../src/design/repair";
import { verifyDesign } from "../src/design/verify";

describe("design repair loop", () => {
  it("repairs deterministic token misses before copy", async () => {
    const spec = parseDesign("editorial hero, minimal header, no testimonials, add pricing, three pages");
    const decision = resolveDesign(spec, {}, { planId: "basic", maxPages: 5 });
    decision.heroLayout = "split";
    decision.header = { ...decision.header, style: "classic" };
    decision.theme.header = decision.header;
    decision.sectionPlan.push({ type: "testimonials", source: "template" });
    const before = verifyDesign(spec, decision, {});
    expect(before.accuracy).toBeLessThan(1);

    let rewrites = 0;
    const result = await repairDesign(spec, decision, {}, { rewrite: () => { rewrites += 1; return {}; } });
    expect(result.report.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(result.decision.heroLayout).toBe("editorial");
    expect(result.decision.theme.header?.style).toBe("minimal");
    expect(result.decision.sectionPlan.some((item) => item.type === "testimonials")).toBe(false);
    expect(rewrites).toBe(0);
    expect(result.rounds).toBe(1);
  });

  it("runs a targeted copy repair only for copy misses", async () => {
    const spec = parseDesign("Mention 'local family run' and friendly tone");
    const decision = resolveDesign(spec);
    const result = await repairDesign(spec, decision, { text: "A website." }, {
      rewrite: () => ({ text: "A local family run website. We welcome you and make it easy." }),
    });
    expect(result.report.unmet).toHaveLength(0);
    expect(result.repaired).toContain("copy_mentions:copy");
    expect(result.content.text).toContain("local family run");
  });

  it("never loops more than two rounds and keeps the best result", async () => {
    const spec = parseDesign("ten pages");
    const decision = resolveDesign(spec, {}, { planId: "free", maxPages: 1 });
    const result = await repairDesign(spec, decision, {}, { maxPages: 1 });
    expect(result.rounds).toBeLessThanOrEqual(2);
    expect(result.report.unmet.some((item) => item.requirementId.includes("page_count"))).toBe(true);
    expect(result.decision.pages).toHaveLength(1);
  });
});
