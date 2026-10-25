import { z } from "zod";
import { blockSchema, createBlock } from "@get-on/blocks";

export const SECTION_TYPES = [
  "hero",
  "heading",
  "text",
  "features",
  "faq",
  "cta",
] as const;

const itemSchema = z.object({
  title: z.string().min(1).max(60),
  text: z.string().max(200),
});

export const sectionDraftSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z.enum([...SECTION_TYPES]),
        eyebrow: z.string().max(40),
        heading: z.string().min(1).max(120),
        text: z.string().max(300),
        items: z.array(itemSchema).max(6),
      }),
    )
    .min(1)
    .max(3),
});

export type SectionDraft = z.infer<typeof sectionDraftSchema>;
export type SectionBlock = z.infer<typeof blockSchema> & { id: string };

export const sectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocks"],
  properties: {
    blocks: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "eyebrow", "heading", "text", "items"],
        properties: {
          type: { type: "string", enum: SECTION_TYPES },
          eyebrow: { type: "string", maxLength: 40 },
          heading: { type: "string", minLength: 1, maxLength: 120 },
          text: { type: "string", maxLength: 300 },
          items: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "text"],
              properties: {
                title: { type: "string", minLength: 1, maxLength: 60 },
                text: { type: "string", maxLength: 200 },
              },
            },
          },
        },
      },
    },
  },
};

function textDoc(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      },
    ],
  };
}

function build(
  type: string,
  props: Record<string, unknown>,
): { block?: SectionBlock; issue?: string } {
  const base = createBlock(type);
  const parsed = blockSchema.safeParse({
    ...base,
    props: { ...base.props, ...props },
  });
  if (!parsed.success) {
    const issue = parsed.error.issues
      .slice(0, 3)
      .map((item) => `${item.path.join(".")}: ${item.message}`)
      .join("; ");
    return { issue: `${type}: ${issue}` };
  }
  return { block: { id: base.id, ...parsed.data } };
}

export function blocksFromDraft(
  draft: SectionDraft,
): { ok: true; data: SectionBlock[] } | { ok: false; issues: string[] } {
  const blocks: SectionBlock[] = [];
  const issues: string[] = [];

  for (const item of draft.blocks) {
    let result: { block?: SectionBlock; issue?: string } = {
      issue: `unknown section type: ${item.type}`,
    };
    switch (item.type) {
      case "hero":
        result = build("hero", {
          eyebrow: item.eyebrow,
          heading: item.heading,
          subheading: item.text,
          buttonLabel: "Get in touch",
          buttonLink: { type: "none" },
          highlights: [],
          layout: "text-only",
          height: "auto",
          align: "center",
          background: "soft",
        });
        break;
      case "heading":
        result = build("heading", {
          eyebrow: item.eyebrow,
          text: item.heading,
          level: "h2",
          align: "left",
          background: "plain",
        });
        break;
      case "text":
        result = build("text", {
          content: textDoc(item.text || item.heading),
          columns: 1,
          size: "normal",
          align: "left",
          background: "plain",
        });
        break;
      case "features":
        result = build("features", {
          heading: item.heading,
          intro: item.text,
          items: item.items.map((entry) => ({
            icon: "star",
            title: entry.title,
            text: entry.text,
            imageId: null,
            link: { type: "none" },
          })),
          layout: "cards",
          columns: 3,
          background: "plain",
        });
        break;
      case "faq":
        result = build("faq", {
          heading: item.heading,
          items: item.items.map((entry) => ({
            question: entry.title,
            answer: entry.text,
          })),
          columns: 1,
          openFirst: false,
          background: "plain",
        });
        break;
      case "cta":
        result = build("cta", {
          eyebrow: item.eyebrow,
          heading: item.heading,
          text: item.text,
          primaryLabel: "Contact us",
          primaryLink: { type: "none" },
          secondaryLabel: "",
          secondaryLink: { type: "none" },
          layout: "strip",
          align: "center",
          background: "soft",
        });
        break;
    }
    if (result.block) blocks.push(result.block);
    if (result.issue) issues.push(result.issue);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, data: blocks };
}
