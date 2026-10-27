import { describe, expect, it } from "vitest";
import { createBlock } from "@get-on/blocks";
import { materializeTemplate, requireSystemTemplate } from "@get-on/templates";
import { parseDesignPrefs } from "@/lib/ai/design-prefs";
import {
  applyWizardDesignToPages,
  buildWizardDesign,
  chooseWizardDesign,
} from "@/lib/ai/wizard-design";

function design() {
  return buildWizardDesign({
    name: "Green Door Cafe",
    businessType: "restaurant",
    about: "We serve coffee and lunch to people in the neighbourhood.",
    prefs: parseDesignPrefs({
      primary: "#112233",
      hero: "centered",
      background: "dark",
      include: ["FAQ"],
    }),
    brief: "",
    teamId: "team-1",
    planId: "pro",
    maxPages: 5,
  });
}

describe("wizard design", () => {
  it("builds three distinct looks from the saved choices", () => {
    const result = design();
    expect(result.looks).toHaveLength(3);
    expect(new Set(result.looks.map((look) => look.key)).size).toBe(3);
    for (const look of result.looks) {
      expect(look.decision.theme.colors?.primary).toBe("#112233");
      expect(look.decision.theme.colorMode).toBe("dark");
      expect(look.decision.heroLayout).toBe("centered");
      expect(look.decision.pages.length).toBeLessThanOrEqual(5);
      expect(look.decision.sectionPlan.some((item) => item.type === "faq")).toBe(true);
    }
  });

  it("chooses the same look for the same wizard answers", () => {
    const first = design();
    const second = design();
    const one = chooseWizardDesign(first, 1);
    const two = chooseWizardDesign(second, 1);
    expect(one.look.key).toBe(two.look.key);
    expect(one.decision.archetype).toBe(two.decision.archetype);
  });

  it("keeps the planned pages, applies the hero and can remove or add the contact form", () => {
    const result = design();
    const { decision } = chooseWizardDesign(result, 0);
    const pkg = requireSystemTemplate(decision.archetype);
    const materialized = materializeTemplate(pkg, {
      profile: {
        businessName: "Green Door Cafe",
        description: "We serve coffee and lunch.",
        businessType: "restaurant",
      },
      maxPages: 5,
      compositionId: decision.compositionId,
    });

    const without = applyWizardDesignToPages(materialized.pages, decision, {
      includeContactForm: false,
    });
    expect(without.length).toBeLessThanOrEqual(decision.pages.length);
    expect(without.some((page) => page.isHome)).toBe(true);
    expect(without.flatMap((page) => page.blocks).some((block) => block.type === "contact-form")).toBe(false);

    const home = without.find((page) => page.isHome)!;
    const hero = home.blocks.find((block) => block.type === "hero")!;
    expect(hero.props.layout).toBe(decision.heroLayout);

    const contact = createBlock("contact-form");
    const withContact = applyWizardDesignToPages(materialized.pages, decision, {
      includeContactForm: true,
      contactBlock: contact,
    });
    expect(withContact.find((page) => page.isHome)!.blocks.some((block) => block.type === "contact-form")).toBe(true);
  });
});
