import type { AiPurpose, AiTaskId } from "../types";

export type SafetyClass = "none" | "standard" | "sensitive";
export type ReviewRule = "none" | "on_flags" | "always";

export type AiTaskDefinition = {
  id: AiTaskId;
  purposes: AiPurpose[];
  targetCredits: number;
  capCredits: number;
  timeoutMs: number;
  safety: SafetyClass;
  review: ReviewRule;
  variants?: Record<
    string,
    {
      targetCredits: number;
      capCredits: number;
    }
  >;
};

export const AI_TASKS: Record<AiTaskId, AiTaskDefinition> = {
  moderate: {
    id: "moderate",
    purposes: ["guard"],
    targetCredits: 0.3,
    capCredits: 1,
    timeoutMs: 20000,
    safety: "none",
    review: "none",
  },
  "site.generate": {
    id: "site.generate",
    purposes: ["brief", "writer", "guard"],
    targetCredits: 8,
    capCredits: 15,
    timeoutMs: 90000,
    safety: "sensitive",
    review: "always",
    variants: {
      fivePages: { targetCredits: 22, capCredits: 35 },
    },
  },
  "template.fill": {
    id: "template.fill",
    purposes: ["brief", "writer"],
    targetCredits: 5,
    capCredits: 20,
    timeoutMs: 60000,
    safety: "sensitive",
    review: "always",
    variants: {
      full: { targetCredits: 12, capCredits: 20 },
    },
  },
  "template.generate": {
    id: "template.generate",
    purposes: ["brief", "writer"],
    targetCredits: 12,
    capCredits: 25,
    timeoutMs: 90000,
    safety: "sensitive",
    review: "always",
  },
  "page.generate": {
    id: "page.generate",
    purposes: ["writer"],
    targetCredits: 6,
    capCredits: 12,
    timeoutMs: 60000,
    safety: "sensitive",
    review: "always",
  },
  "section.generate": {
    id: "section.generate",
    purposes: ["writer"],
    targetCredits: 3,
    capCredits: 6,
    timeoutMs: 45000,
    safety: "sensitive",
    review: "always",
  },
  "text.write": {
    id: "text.write",
    purposes: ["writer"],
    targetCredits: 1,
    capCredits: 3,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "text.improve": {
    id: "text.improve",
    purposes: ["writer"],
    targetCredits: 1,
    capCredits: 3,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "list.expand": {
    id: "list.expand",
    purposes: ["writer"],
    targetCredits: 2,
    capCredits: 4,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "seo.write": {
    id: "seo.write",
    purposes: ["writer"],
    targetCredits: 1,
    capCredits: 10,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "alt.describe": {
    id: "alt.describe",
    purposes: ["vision"],
    targetCredits: 1,
    capCredits: 2,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "design.suggest": {
    id: "design.suggest",
    purposes: ["brief"],
    targetCredits: 2,
    capCredits: 4,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "profile.write": {
    id: "profile.write",
    purposes: ["writer"],
    targetCredits: 1,
    capCredits: 2,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "tips.fix": {
    id: "tips.fix",
    purposes: [],
    targetCredits: 0,
    capCredits: 0,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
  "image.generate": {
    id: "image.generate",
    purposes: ["image"],
    targetCredits: 5,
    capCredits: 10,
    timeoutMs: 120000,
    safety: "sensitive",
    review: "always",
  },
  repair: {
    id: "repair",
    purposes: [],
    targetCredits: 0,
    capCredits: 0,
    timeoutMs: 45000,
    safety: "standard",
    review: "on_flags",
  },
};

export function getTask(id: AiTaskId): AiTaskDefinition {
  return AI_TASKS[id];
}
