import { describe, expect, it } from "vitest";
import { parseDesign } from "../src/design/parse";
import { resolveDesign } from "../src/design/resolve";
import { chooseVariation, designSeed, historyEntry, resolveDesignOptions, resolveDesignWithHistory, variationKey } from "../src/design/variation";

describe("design variation", () => {
  it("returns three distinct looks that keep user requirements", () => {
    const spec = parseDesign("Modern and clean, green, five pages");
    const options = resolveDesignOptions(spec, { businessType: "consultant" }, { planId: "basic", maxPages: 5 }, { count: 3 });
    expect(options).toHaveLength(3);
    expect(new Set(options.map(variationKey)).size).toBe(3);
    for (const option of options) {
      expect(option.theme.colors?.primary.toLowerCase()).toBe("#008000");
      expect(option.pages).toHaveLength(5);
    }
  });

  it("avoids the last five combinations unless nothing else fits", () => {
    const spec = parseDesign("modern and clean");
    const options = resolveDesignOptions(spec, { businessType: "consultant" }, {}, { count: 3 });
    const history = [historyEntry(options[0]!)];
    const picked = chooseVariation(options, designSeed("team", "request"), history);
    expect(variationKey(picked)).not.toBe(variationKey(options[0]!));
  });

  it("keeps no more than 15 percent on the same look across 100 sites", () => {
    const businessTypes = ["restaurant", "salon-beauty", "shop", "portfolio", "consultant", "church-community", "repair-services", "farm-agriculture", "education-tutoring", "other"];
    const counts = new Map<string, number>();
    const archetypes = new Set<string>();
    const history: ReturnType<typeof historyEntry>[] = [];
    for (let index = 0; index < 100; index += 1) {
      const spec = parseDesign("A modern, friendly website with a clear next step");
      const decision = resolveDesignWithHistory(spec, {
        businessType: businessTypes[index % businessTypes.length]!,
        teamId: "team",
        requestId: `request-${index}`,
      }, {}, history);
      const key = variationKey(decision);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      archetypes.add(decision.archetype);
      history.push(historyEntry(decision));
    }
    const max = Math.max(...counts.values());
    expect(max).toBeLessThanOrEqual(15);
    expect(archetypes.size).toBeGreaterThanOrEqual(5);
  });
});
