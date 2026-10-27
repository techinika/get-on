import { z } from "zod";
import { REQUIREMENT_KINDS } from "@get-on/ai";

const valueSchema = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.array(z.string().max(100)).max(40),
  z.record(z.union([z.string().max(200), z.number(), z.boolean()])),
]);

const requirementSchema = z.object({
  kind: z.enum(REQUIREMENT_KINDS),
  target: z.string().min(1).max(80),
  value: valueSchema,
  strength: z.enum(["must", "should", "nice"]),
  evidence: z.string().max(300).optional(),
});

export const designInterpretationSchema = z.object({
  requirements: z.array(requirementSchema).max(40),
  palette: z
    .object({
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      text: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      soft: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      mode: z.enum(["light", "dark", "auto"]).optional(),
      mood: z
        .enum(["warm", "cool", "earthy", "pastel", "vibrant", "muted", "neon", "luxury", "fresh", "natural", "playful", "corporate"])
        .optional(),
    })
    .default({}),
  fonts: z
    .object({
      heading: z.string().max(80).optional(),
      body: z.string().max(80).optional(),
      feel: z.enum(["elegant", "modern", "techy", "friendly", "bold", "classic", "quirky"]).optional(),
    })
    .default({}),
  layout: z
    .object({
      hero: z.string().max(40).optional(),
      header: z.string().max(40).optional(),
      footer: z.string().max(40).optional(),
      density: z.enum(["compact", "comfortable", "airy"]).optional(),
      rhythm: z.enum(["even", "alternate", "tinted", "bold"]).optional(),
      corners: z.enum(["sharp", "soft", "round"]).optional(),
      buttonShape: z.enum(["square", "soft", "round", "pill"]).optional(),
      buttonStyle: z.enum(["solid", "outline", "soft"]).optional(),
      imageStyle: z.enum(["rounded", "sharp", "arch", "offset", "circle"]).optional(),
      align: z.enum(["left", "center"]).optional(),
    })
    .default({}),
  sections: z
    .object({
      include: z.array(z.string().max(60)).max(20).default([]),
      exclude: z.array(z.string().max(60)).max(20).default([]),
      order: z.array(z.string().max(60)).max(20).optional(),
    })
    .default({ include: [], exclude: [] }),
  pages: z
    .object({
      include: z.array(z.string().max(60)).max(20).default([]),
      exclude: z.array(z.string().max(60)).max(20).default([]),
      count: z.number().int().min(1).max(30).optional(),
    })
    .default({ include: [], exclude: [] }),
  tone: z.array(z.enum(["friendly", "professional", "bold", "calm", "playful", "elegant", "warm", "direct", "luxury", "technical"])).max(3).default([]),
  copy: z
    .object({
      mention: z.array(z.string().max(80)).max(20).default([]),
      avoidWords: z.array(z.string().max(80)).max(20).default([]),
      useWords: z.array(z.string().max(80)).max(20).default([]),
    })
    .default({ mention: [], avoidWords: [], useWords: [] }),
  unsupported: z.array(z.object({ text: z.string().max(200), nearest: z.string().max(200).optional() })).max(20).default([]),
  clarifications: z
    .array(z.object({ question: z.string().max(200), options: z.array(z.string().max(80)).min(2).max(6) }))
    .max(2)
    .default([]),
  confidence: z.number().min(0).max(1).default(0),
});

export type DesignInterpretation = z.infer<typeof designInterpretationSchema>;

const hex = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };

export const designInterpretationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["requirements", "confidence"],
  properties: {
    requirements: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "target", "value", "strength"],
        properties: {
          kind: { type: "string", enum: REQUIREMENT_KINDS },
          target: { type: "string", minLength: 1, maxLength: 80 },
          value: {
            anyOf: [
              { type: "string", maxLength: 200 },
              { type: "number" },
              { type: "boolean" },
              { type: "array", maxItems: 40, items: { type: "string", maxLength: 100 } },
              { type: "object", additionalProperties: { anyOf: [{ type: "string", maxLength: 200 }, { type: "number" }, { type: "boolean" }] } },
            ],
          },
          strength: { type: "string", enum: ["must", "should", "nice"] },
          evidence: { type: "string", maxLength: 300 },
        },
      },
    },
    palette: {
      type: "object",
      additionalProperties: false,
      properties: {
        primary: hex,
        accent: hex,
        background: hex,
        text: hex,
        soft: hex,
        mode: { type: "string", enum: ["light", "dark", "auto"] },
        mood: { type: "string", enum: ["warm", "cool", "earthy", "pastel", "vibrant", "muted", "neon", "luxury", "fresh", "natural", "playful", "corporate"] },
      },
    },
    fonts: {
      type: "object",
      additionalProperties: false,
      properties: {
        heading: { type: "string", maxLength: 80 },
        body: { type: "string", maxLength: 80 },
        feel: { type: "string", enum: ["elegant", "modern", "techy", "friendly", "bold", "classic", "quirky"] },
      },
    },
    layout: {
      type: "object",
      additionalProperties: false,
      properties: {
        hero: { type: "string", maxLength: 40 },
        header: { type: "string", maxLength: 40 },
        footer: { type: "string", maxLength: 40 },
        density: { type: "string", enum: ["compact", "comfortable", "airy"] },
        rhythm: { type: "string", enum: ["even", "alternate", "tinted", "bold"] },
        corners: { type: "string", enum: ["sharp", "soft", "round"] },
        buttonShape: { type: "string", enum: ["square", "soft", "round", "pill"] },
        buttonStyle: { type: "string", enum: ["solid", "outline", "soft"] },
        imageStyle: { type: "string", enum: ["rounded", "sharp", "arch", "offset", "circle"] },
        align: { type: "string", enum: ["left", "center"] },
      },
    },
    sections: {
      type: "object",
      additionalProperties: false,
      properties: {
        include: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
        exclude: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
        order: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
      },
    },
    pages: {
      type: "object",
      additionalProperties: false,
      properties: {
        include: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
        exclude: { type: "array", maxItems: 20, items: { type: "string", maxLength: 60 } },
        count: { type: "integer", minimum: 1, maximum: 30 },
      },
    },
    tone: { type: "array", maxItems: 3, items: { type: "string", enum: ["friendly", "professional", "bold", "calm", "playful", "elegant", "warm", "direct", "luxury", "technical"] } },
    copy: {
      type: "object",
      additionalProperties: false,
      properties: {
        mention: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } },
        avoidWords: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } },
        useWords: { type: "array", maxItems: 20, items: { type: "string", maxLength: 80 } },
      },
    },
    unsupported: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string", maxLength: 200 }, nearest: { type: "string", maxLength: 200 } },
      },
    },
    clarifications: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options"],
        properties: {
          question: { type: "string", maxLength: 200 },
          options: { type: "array", minItems: 2, maxItems: 6, items: { type: "string", maxLength: 80 } },
        },
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};
