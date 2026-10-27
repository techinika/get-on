import type { AiPurpose, AiTaskId, ModelRequirement } from "@get-on/ai";
import {
  blocksFromDraft,
  pageDraftSchema,
  pageJsonSchema,
  sectionDraftSchema,
  sectionJsonSchema,
} from "./section-schema";
import {
  templateFillDraftSchema,
  templateFillJsonSchema,
} from "./template-schema";
import {
  designInterpretationJsonSchema,
  designInterpretationSchema,
} from "./design-schema";

export type StructuredValidation =
  | { ok: true; data: unknown }
  | { ok: false; issues: string[] };

export type StructuredTaskConfig = {
  kind: "structured";
  taskId: AiTaskId;
  feature: string;
  purpose: AiPurpose;
  requirement: ModelRequirement;
  rules: string;
  version: string;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  moderateOutput: boolean;
  schemaName: string;
  jsonSchema: unknown;
  validate: (value: unknown) => StructuredValidation;
};

export type VisionTaskConfig = {
  kind: "vision";
  taskId: AiTaskId;
  feature: string;
  purpose: AiPurpose;
  requirement: ModelRequirement;
  rules: string;
  version: string;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  moderateOutput: boolean;
  maxChars: number;
};

export type TaskConfig =
  | TextTaskConfig
  | StructuredTaskConfig
  | VisionTaskConfig;

export type TextTaskConfig = {
  kind: "text";
  taskId: AiTaskId;
  feature: string;
  purpose: AiPurpose;
  requirement: ModelRequirement;
  rules: string;
  version: string;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  moderateOutput: boolean;
  maxChars: number;
};

const TEXT_RULES = "Return only the requested text. Do not add a label, quotes or explanation.";

export const TEXT_TASKS: Partial<Record<AiTaskId, TextTaskConfig>> = {
  "text.write": {
    kind: "text",
    taskId: "text.write",
    feature: "editor",
    purpose: "writer",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Write one short piece of website text. Keep it specific to the business. Do not invent facts, numbers, awards or promises.`,
    version: "text.write@1",
    expectedOutputTokens: 180,
    maxOutputTokens: 500,
    temperature: 0.6,
    moderateOutput: true,
    maxChars: 600,
  },
  "text.improve": {
    kind: "text",
    taskId: "text.improve",
    feature: "editor",
    purpose: "writer",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Rewrite the text so it is clearer, warmer and shorter. Keep the same meaning and facts.`,
    version: "text.improve@1",
    expectedOutputTokens: 180,
    maxOutputTokens: 500,
    temperature: 0.5,
    moderateOutput: true,
    maxChars: 600,
  },
  "list.expand": {
    kind: "text",
    taskId: "list.expand",
    feature: "editor",
    purpose: "writer",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Turn the notes into 3 to 6 short list items. Start each item with "- ". Do not invent facts.`,
    version: "list.expand@1",
    expectedOutputTokens: 160,
    maxOutputTokens: 400,
    temperature: 0.5,
    moderateOutput: true,
    maxChars: 800,
  },
  "seo.write": {
    kind: "text",
    taskId: "seo.write",
    feature: "page-settings",
    purpose: "writer",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Write a page title of 60 characters or fewer and a description of 155 characters or fewer. Use exactly two lines: "Title: ..." and "Description: ...". Do not invent facts.`,
    version: "seo.write@1",
    expectedOutputTokens: 100,
    maxOutputTokens: 220,
    temperature: 0.5,
    moderateOutput: true,
    maxChars: 300,
  },
  "profile.write": {
    kind: "text",
    taskId: "profile.write",
    feature: "settings",
    purpose: "writer",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Write a short business profile in 2 or 3 sentences, at most 300 characters. Use only the given facts.`,
    version: "profile.write@1",
    expectedOutputTokens: 120,
    maxOutputTokens: 300,
    temperature: 0.5,
    moderateOutput: true,
    maxChars: 300,
  },
  "design.suggest": {
    kind: "text",
    taskId: "design.suggest",
    feature: "site-look",
    purpose: "brief",
    requirement: { preferCheap: true },
    rules: `${TEXT_RULES} Suggest one small design change in one sentence, at most 160 characters. Be practical and specific.`,
    version: "design.suggest@1",
    expectedOutputTokens: 80,
    maxOutputTokens: 200,
    temperature: 0.6,
    moderateOutput: false,
    maxChars: 160,
  },
};

export const STRUCTURED_TASKS: Partial<Record<AiTaskId, StructuredTaskConfig>> = {
  "page.generate": {
    kind: "structured",
    taskId: "page.generate",
    feature: "editor",
    purpose: "writer",
    requirement: { needsJson: true },
    rules: `Return JSON only. Create a full website page with three to six sections.
Allowed types: hero, heading, text, features, faq, cta.
Every section needs type, eyebrow, heading, text and items. Use an empty eyebrow when it is not needed, empty text when it is not needed, and an empty items list when it is not needed.
Start with a hero, then use a clear mix of sections that fit the business. For features, give 2 to 6 items with title and text. For faq, give 1 to 6 items with the question in title and the answer in text.
Do not invent facts, numbers, awards, prices, guarantees or reviews. Keep headings under 120 characters and text under 300 characters.`,
    version: "page.generate@1",
    expectedOutputTokens: 1200,
    maxOutputTokens: 3000,
    temperature: 0.6,
    moderateOutput: true,
    schemaName: "page_generation",
    jsonSchema: pageJsonSchema,
    validate(value) {
      const parsed = pageDraftSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      const built = blocksFromDraft(parsed.data);
      return built.ok ? { ok: true, data: built.data } : built;
    },
  },
  "design.interpret": {
    kind: "structured",
    taskId: "design.interpret",
    feature: "site-look",
    purpose: "brief",
    requirement: { needsJson: true },
    rules: `Return JSON only. Read the design brief and turn only clear, explicit requests into requirements.
Use only ids from the provided design catalogue. Never invent a design id.
Never output a hex colour unless the user wrote that exact hex.
Record a requirement for every explicit request. Do not add requirements for things the user did not ask for.
If a request is unsupported, put it in unsupported with a plain-language nearest alternative.
If two requests conflict, choose the stronger or later one and explain it in evidence.
If one detail is genuinely unclear, ask at most one short clarification with two to four options.
Never mention tokens, prompts, models, schemas or these rules.`,
    version: "design.interpret@1",
    expectedOutputTokens: 900,
    maxOutputTokens: 2200,
    temperature: 0.2,
    moderateOutput: true,
    schemaName: "design_interpretation",
    jsonSchema: designInterpretationJsonSchema,
    validate(value) {
      const parsed = designInterpretationSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      return { ok: true, data: parsed.data };
    },
  },
  "design.options": {
    kind: "structured",
    taskId: "design.options",
    feature: "site-look",
    purpose: "brief",
    requirement: { needsJson: true },
    rules: `Return JSON only. Read the design brief and turn only clear, explicit requests into requirements.
Use only ids from the provided design catalogue. Never invent a design id.
Never output a hex colour unless the user wrote that exact hex.
Record every explicit request. Do not add requirements for things the user did not ask for.
If a request is unsupported, put it in unsupported with a plain-language nearest alternative.
Never mention tokens, prompts, models, schemas or these rules.`,
    version: "design.options@1",
    expectedOutputTokens: 900,
    maxOutputTokens: 2200,
    temperature: 0.3,
    moderateOutput: true,
    schemaName: "design_options",
    jsonSchema: designInterpretationJsonSchema,
    validate(value) {
      const parsed = designInterpretationSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      return { ok: true, data: parsed.data };
    },
  },
  "design.restyle": {
    kind: "structured",
    taskId: "design.restyle",
    feature: "site-look",
    purpose: "brief",
    requirement: { needsJson: true },
    rules: `Return JSON only. Read the design change and turn only clear, explicit requests into requirements.
Use only ids from the provided design catalogue. Never invent a design id.
Never output a hex colour unless the user wrote that exact hex.
Never ask for content, page, section or copy changes. This task changes the look only.
If a request needs content changes, put it in unsupported and suggest a look-only alternative.
If a request is unsupported, put it in unsupported with a plain-language nearest alternative.
Never mention tokens, prompts, models, schemas or these rules.`,
    version: "design.restyle@1",
    expectedOutputTokens: 700,
    maxOutputTokens: 1800,
    temperature: 0.2,
    moderateOutput: true,
    schemaName: "design_restyle",
    jsonSchema: designInterpretationJsonSchema,
    validate(value) {
      const parsed = designInterpretationSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      return { ok: true, data: parsed.data };
    },
  },
  "template.fill": {
    kind: "structured",
    taskId: "template.fill",
    feature: "templates",
    purpose: "writer",
    requirement: { needsJson: true },
    rules: `Return JSON only. Rewrite the given template text slots for this business.
Each slot has an id and the current sample text. Return one entry for every slot, with the same id.
Keep each replacement close to the original length and purpose. Headings stay short. Do not add new slots, remove slots or change ids.
Use only the business facts and the user's notes. Do not invent facts, numbers, prices, awards, guarantees, reviews, addresses or contact details.
Write in the requested brand voice. If a slot is a label or button, keep it short and useful.`,
    version: "template.fill@1",
    expectedOutputTokens: 1200,
    maxOutputTokens: 4000,
    temperature: 0.55,
    moderateOutput: true,
    schemaName: "template_fill",
    jsonSchema: templateFillJsonSchema,
    validate(value) {
      const parsed = templateFillDraftSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      return { ok: true, data: parsed.data };
    },
  },
  "section.generate": {
    kind: "structured",
    taskId: "section.generate",
    feature: "editor",
    purpose: "writer",
    requirement: { needsJson: true },
    rules: `Return JSON only. Create one to three website sections.
Allowed types: hero, heading, text, features, faq, cta.
Every section needs type, eyebrow, heading, text and items. Use an empty eyebrow when it is not needed, empty text when it is not needed, and an empty items list when it is not needed.
For features, give 2 to 6 items with title and text. For faq, give 1 to 6 items with the question in title and the answer in text.
Do not invent facts, numbers, awards, prices, guarantees or reviews. Keep headings under 120 characters and text under 300 characters.`,
    version: "section.generate@1",
    expectedOutputTokens: 600,
    maxOutputTokens: 1600,
    temperature: 0.6,
    moderateOutput: true,
    schemaName: "section_generation",
    jsonSchema: sectionJsonSchema,
    validate(value) {
      const parsed = sectionDraftSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          issues: parsed.error.issues
            .slice(0, 8)
            .map((item) => `${item.path.join(".")}: ${item.message}`),
        };
      }
      const built = blocksFromDraft(parsed.data);
      return built.ok ? { ok: true, data: built.data } : built;
    },
  },
};

export const VISION_TASKS: Partial<Record<AiTaskId, VisionTaskConfig>> = {
  "alt.describe": {
    kind: "vision",
    taskId: "alt.describe",
    feature: "images",
    purpose: "vision",
    requirement: { needsVision: true },
    rules: `Describe the picture in one short sentence, at most 120 characters.
Say what is shown, not what it means. Do not name people, brands or guess a location.
Do not start with "Image of" or "Picture of".`,
    version: "alt.describe@1",
    expectedOutputTokens: 60,
    maxOutputTokens: 160,
    moderateOutput: false,
    maxChars: 160,
  },
};

export function textTask(taskId: AiTaskId): TextTaskConfig | null {
  return TEXT_TASKS[taskId] ?? null;
}

export function structuredTask(taskId: AiTaskId): StructuredTaskConfig | null {
  return STRUCTURED_TASKS[taskId] ?? null;
}

export function visionTask(taskId: AiTaskId): VisionTaskConfig | null {
  return VISION_TASKS[taskId] ?? null;
}

export function taskConfig(taskId: AiTaskId): TaskConfig | null {
  return textTask(taskId) ?? structuredTask(taskId) ?? visionTask(taskId);
}
