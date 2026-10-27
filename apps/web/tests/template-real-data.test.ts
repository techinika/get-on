import { describe, expect, it } from "vitest";
import { countSampleBlocks, validateContent } from "@get-on/blocks";
import {
  SYSTEM_TEMPLATES,
  materializeTemplate,
  scanSampleLeaks,
  validateTemplatePackage,
} from "@get-on/templates";

const full = {
  businessName: "Maple Street Studio",
  tagline: "Thoughtful work for local people",
  description: "A small studio helping neighbours with practical, friendly service.",
  phone: "+254 700 123 456",
  email: "hello@maplestreet.co",
  address: "4 Market Lane, Nairobi",
  hoursNote: "Mon to Fri 9am to 5pm",
  social: [{ network: "instagram", url: "https://instagram.com/maplestreet" }],
  businessType: "consultant",
  city: "Nairobi",
  region: "Nairobi County",
  country: "Kenya",
  areaServed: "Nairobi and nearby",
};

const nameOnly = { businessName: "Maple Street Studio" };
const nameAndType = { businessName: "Maple Street Studio", businessType: "shop" };

describe("template real data", () => {
  for (const pkg of SYSTEM_TEMPLATES) {
    it(`${pkg.meta.slug} validates and leaves no sample details`, () => {
      expect(validateTemplatePackage(pkg).ok).toBe(true);
      for (const profile of [full, nameOnly, nameAndType]) {
        const result = materializeTemplate(pkg, { profile });
        expect(result.pages.length).toBeGreaterThanOrEqual(2);
        const blocks = result.pages.flatMap((page) => page.blocks);
        expect(scanSampleLeaks(blocks, pkg.sampleProfile)).toEqual([]);
        expect(result.pages.every((page) => !page.title.includes("{{"))).toBe(true);
      }
    });
  }

  it("marks sample-only sections so the editor and publish check can warn", () => {
    for (const pkg of SYSTEM_TEMPLATES) {
      const result = materializeTemplate(pkg, { profile: full });
      const blocks = result.pages.flatMap((page) => page.blocks) as Array<Record<string, unknown>>;
      expect(countSampleBlocks(blocks)).toBeGreaterThan(0);
      expect(blocks.some((block) => block.sampleOnly === true)).toBe(true);

      const validated = validateContent({ schemaVersion: 4, blocks });
      expect(validated.ok).toBe(true);
      expect(
        (validated.content?.blocks as Array<Record<string, unknown>>).some(
          (block) => block.sampleOnly === true,
        ),
      ).toBe(true);
    }
  });

  it("keeps the home page first when a plan limits pages", () => {
    const pkg = SYSTEM_TEMPLATES[0]!;
    const result = materializeTemplate(pkg, { profile: full, maxPages: 1 });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]!.isHome).toBe(true);
  });

  it("hides blocks whose required data is missing", () => {
    const pkg = SYSTEM_TEMPLATES[0]!;
    const result = materializeTemplate(pkg, { profile: nameAndType });
    const blocks = result.pages.flatMap((page) => page.blocks) as Array<Record<string, unknown>>;
    for (const block of blocks) {
      const includeIf = block.includeIf ?? (block.props as Record<string, unknown> | undefined)?.includeIf;
      expect(["phone", "email", "address", "hours", "social", "logo", "description", "tagline", "city", "areaServed"]).not.toContain(includeIf);
    }
  });
});
