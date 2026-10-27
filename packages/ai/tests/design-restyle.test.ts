import { describe, expect, it } from "vitest";
import { SYSTEM_TEMPLATES } from "@get-on/templates";
import { restyleDesign } from "../src/design/restyle";
import { designLooks } from "../src/design/looks";
import { parseDesign } from "../src/design/parse";
import { resolveDesign } from "../src/design/resolve";

const template = SYSTEM_TEMPLATES[0]!;
const composition = template.compositions[0]!;
const base = resolveDesign(parseDesign("Use sage"), { businessType: "restaurant" }, { planId: "pro" });

const current = {
  theme: composition.theme,
  heroLayout: "split",
  heroProps: { layout: "split" },
  header: composition.theme.header,
  footer: composition.theme.footer,
  sectionPlan: base.sectionPlan,
  pages: ["home", "about", "contact"],
};

describe("restyle", () => {
  it("changes the look but never the content", () => {
    const result = restyleDesign("Use navy, Playfair Display headings and an editorial hero", current);
    expect(result.contentChanged).toBe(false);
    expect(result.decision.sectionPlan).toBe(current.sectionPlan);
    expect(result.decision.pages).toEqual(current.pages);
    expect(result.decision.heroLayout).toBe("editorial");
    expect(result.decision.theme.colors?.primary).toBeDefined();
    expect(result.changes.some((entry) => entry.area === "hero")).toBe(true);
  });

  it("reports no preview change when the brief matches the current look", () => {
    const result = restyleDesign("Keep the current look", current);
    expect(result.previewChanged).toBe(false);
    expect(result.changes).toEqual([]);
  });
});

describe("design looks", () => {
  it("returns three distinct looks with plain-language names", () => {
    const looks = designLooks(parseDesign("Warm, friendly and modern"), { businessType: "cafe" });
    expect(looks).toHaveLength(3);
    expect(new Set(looks.map((look) => look.key)).size).toBe(3);
    expect(looks.every((look) => look.name && look.description && look.decision)).toBe(true);
  });
});
