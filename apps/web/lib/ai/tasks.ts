import type { AiPurpose, AiTaskId, ModelRequirement } from "@get-on/ai";

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

export function textTask(taskId: AiTaskId): TextTaskConfig | null {
  return TEXT_TASKS[taskId] ?? null;
}
