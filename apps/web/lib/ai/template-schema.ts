import { z } from "zod";

export const templateFillDraftSchema = z.object({
  slots: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        text: z.string().max(1200),
      }),
    )
    .min(1)
    .max(80),
});

export type TemplateFillDraft = z.infer<typeof templateFillDraftSchema>;

export const templateFillJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["slots"],
  properties: {
    slots: {
      type: "array",
      minItems: 1,
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 160 },
          text: { type: "string", maxLength: 1200 },
        },
      },
    },
  },
};
