import { describe, expect, it } from "vitest";
import {
  blocksFromDraft,
  pageDraftSchema,
  pageJsonSchema,
  sectionDraftSchema,
  sectionJsonSchema,
} from "@/lib/ai/section-schema";
import { structuredTask } from "@/lib/ai/tasks";

const hero = {
  type: "hero" as const,
  eyebrow: "",
  heading: "A calmer way to run your shop",
  text: "Simple tools for orders, stock and happy customers.",
  items: [],
};

describe("AI section generation", () => {
  it("turns a draft into validated blocks with ids", () => {
    const draft = sectionDraftSchema.parse({
      blocks: [
        hero,
        {
          type: "features",
          eyebrow: "",
          heading: "What you get",
          text: "",
          items: [
            { title: "One place", text: "See every order." },
            { title: "Less admin", text: "Spend time on the shop." },
          ],
        },
      ],
    });

    const result = blocksFromDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].type).toBe("hero");
    expect(result.data[0].id.length).toBeGreaterThanOrEqual(10);
    const features = result.data[1];
    expect(features.type).toBe("features");
    if (features.type === "features") {
      expect(features.props.items).toHaveLength(2);
    }
  });

  it("rejects a section that cannot become a valid block", () => {
    const result = blocksFromDraft({
      blocks: [
        {
          type: "faq",
          eyebrow: "",
          heading: "Questions",
          text: "",
          items: [],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("uses a strict JSON schema for the section task", () => {
    expect(sectionJsonSchema.additionalProperties).toBe(false);
    expect(sectionJsonSchema.required).toEqual(["blocks"]);
    const task = structuredTask("section.generate");
    expect(task?.requirement.needsJson).toBe(true);
    expect(task?.validate({ blocks: [hero] }).ok).toBe(true);
  });

  it("allows up to six sections for a full page", () => {
    expect(pageJsonSchema.properties.blocks.maxItems).toBe(6);
    const blocks = Array.from({ length: 6 }, () => hero);
    expect(pageDraftSchema.safeParse({ blocks }).success).toBe(true);
    const task = structuredTask("page.generate");
    expect(task?.validate({ blocks }).ok).toBe(true);
  });
});
