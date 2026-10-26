import { describe, expect, it } from "vitest";
import { createBlock } from "@get-on/blocks";
import {
  applyTemplateSlots,
  collectTemplateSlots,
} from "@/lib/ai/template-slots";

function hero() {
  const block = createBlock("hero");
  block.props = {
    ...block.props,
    eyebrow: "Welcome",
    heading: "Sample heading",
    subheading: "Sample subheading",
    buttonLabel: "Get in touch",
    buttonLink: { type: "url", url: "https://example.com" },
    highlights: ["Fast", "Friendly"],
    imageId: null,
  };
  return block;
}

describe("template fill slots", () => {
  it("collects text and skips links, ids and layout values", () => {
    const block = hero();
    const plan = collectTemplateSlots([{ id: "page-1", blocks: [block] }]);
    const texts = plan.slots.map((slot) => slot.text);

    expect(texts).toContain("Welcome");
    expect(texts).toContain("Sample heading");
    expect(texts).toContain("Sample subheading");
    expect(texts).toContain("Get in touch");
    expect(texts).toContain("Fast");
    expect(texts).not.toContain("https://example.com");
    expect(texts).not.toContain("text-only");
    expect(plan.slots.every((slot) => slot.id.includes(block.id))).toBe(true);
  });

  it("applies replacements and keeps the block valid", () => {
    const block = hero();
    const pages = [{ id: "page-1", blocks: [block] }];
    const plan = collectTemplateSlots(pages);
    const heading = plan.slots.find((slot) => slot.text === "Sample heading");
    const subheading = plan.slots.find((slot) => slot.text === "Sample subheading");
    expect(heading).toBeDefined();
    expect(subheading).toBeDefined();

    const applied = applyTemplateSlots(
      pages,
      plan,
      new Map([
        [heading!.id, "A much better headline for the business"],
        [subheading!.id, "We help local teams get online quickly."],
      ]),
    );

    expect(applied.changed).toBe(2);
    const updated = applied.pages[0]!.blocks[0] as typeof block;
    expect(updated.props.heading).toBe("A much better headline for the business");
    expect(updated.props.subheading).toBe("We help local teams get online quickly.");
    expect(updated.props.buttonLabel).toBe("Get in touch");
    expect(updated.props.highlights).toEqual(["Fast", "Friendly"]);
  });

  it("clamps text that is too long for the field", () => {
    const block = hero();
    const pages = [{ id: "page-1", blocks: [block] }];
    const plan = collectTemplateSlots(pages);
    const heading = plan.slots.find((slot) => slot.text === "Sample heading");
    expect(heading).toBeDefined();

    const applied = applyTemplateSlots(
      pages,
      plan,
      new Map([[heading!.id, "x".repeat(200)]]),
    );

    const updated = applied.pages[0]!.blocks[0] as typeof block;
    expect(updated.props.heading).toHaveLength(120);
  });

  it("ignores unknown slot ids", () => {
    const block = hero();
    const pages = [{ id: "page-1", blocks: [block] }];
    const plan = collectTemplateSlots(pages);
    const applied = applyTemplateSlots(
      pages,
      plan,
      new Map([["missing-slot", "Should not be used"]]),
    );

    expect(applied.changed).toBe(0);
    const unchanged = applied.pages[0]!.blocks[0] as typeof block;
    expect(unchanged.props.heading).toBe("Sample heading");
  });
});
