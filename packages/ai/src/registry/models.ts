import type { AiModel, AiPurpose } from "../types";

export const MODEL_SEEDS: AiModel[] = [
  {
    id: "llama-3.3-70b",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    purposes: ["brief", "writer", "judge"],
    neuronsPerMInput: 26668,
    neuronsPerMOutput: 204805,
    neuronsPerImage: null,
    contextTokens: 24000,
    maxOutputTokens: 4096,
    supportsJson: true,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes:
      "Primary structured model. Docs verified 2026-10-25; live JSON smoke test pending.",
    verifiedAt: null,
  },
  {
    id: "llama-3.2-3b",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-3.2-3b-instruct",
    purposes: ["writer"],
    neuronsPerMInput: 4625,
    neuronsPerMOutput: 30475,
    neuronsPerImage: null,
    contextTokens: 80000,
    maxOutputTokens: 2048,
    supportsJson: false,
    supportsVision: false,
    enabled: true,
    fallbackId: "llama-3.3-70b",
    notes: "Cheap plain-text model. Not on the JSON Mode list.",
    verifiedAt: null,
  },
  {
    id: "gemma-4-26b",
    provider: "workers-ai",
    modelId: "@cf/google/gemma-4-26b-a4b-it",
    purposes: ["vision", "writer"],
    neuronsPerMInput: 9091,
    neuronsPerMOutput: 27273,
    neuronsPerImage: null,
    contextTokens: 256000,
    maxOutputTokens: 4096,
    supportsJson: false,
    supportsVision: true,
    enabled: true,
    fallbackId: "llama-3.2-11b-vision",
    notes: "Vision and plain text. Preferred vision model.",
    verifiedAt: null,
  },
  {
    id: "llama-3.2-11b-vision",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-3.2-11b-vision-instruct",
    purposes: ["vision"],
    neuronsPerMInput: 4410,
    neuronsPerMOutput: 61493,
    neuronsPerImage: null,
    contextTokens: 128000,
    maxOutputTokens: 2048,
    supportsJson: false,
    supportsVision: true,
    enabled: true,
    fallbackId: null,
    notes: "Vision alternative. Requires accepting the Meta licence.",
    verifiedAt: null,
  },
  {
    id: "llama-guard-3-8b",
    provider: "workers-ai",
    modelId: "@cf/meta/llama-guard-3-8b",
    purposes: ["guard"],
    neuronsPerMInput: 44003,
    neuronsPerMOutput: 2730,
    neuronsPerImage: null,
    contextTokens: 131072,
    maxOutputTokens: 1024,
    supportsJson: false,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes:
      "Moderation. Output can be a string or {safe,categories}; categories S1-S14.",
    verifiedAt: null,
  },
  {
    id: "flux-1-schnell",
    provider: "workers-ai",
    modelId: "@cf/black-forest-labs/flux-1-schnell",
    purposes: ["image"],
    neuronsPerMInput: null,
    neuronsPerMOutput: null,
    neuronsPerImage: null,
    contextTokens: 2048,
    maxOutputTokens: 0,
    supportsJson: false,
    supportsVision: false,
    enabled: true,
    fallbackId: null,
    notes:
      "Image generation. 4.80 neurons per 512 tile plus 9.60 per step; default 4 steps, maximum 8. Images are disabled by default.",
    verifiedAt: null,
  },
];

export type ModelRequirement = {
  needsJson?: boolean;
  needsVision?: boolean;
  maxPromptTokens?: number;
  preferCheap?: boolean;
};

function matchesRequirement(
  model: AiModel,
  purpose: AiPurpose,
  requirement: ModelRequirement,
): boolean {
  if (!model.enabled || !model.purposes.includes(purpose)) return false;
  if (requirement.needsJson && !model.supportsJson) return false;
  if (requirement.needsVision && !model.supportsVision) return false;
  if (
    requirement.maxPromptTokens !== undefined &&
    model.contextTokens < requirement.maxPromptTokens
  ) {
    return false;
  }
  return true;
}

function inputPrice(model: AiModel): number {
  return model.neuronsPerMInput ?? Number.POSITIVE_INFINITY;
}

export function modelFor(
  purpose: AiPurpose,
  requirement: ModelRequirement = {},
  models: AiModel[] = MODEL_SEEDS,
): AiModel | null {
  const matches = models.filter((model) =>
    matchesRequirement(model, purpose, requirement),
  );
  if (matches.length === 0) return null;

  if (requirement.preferCheap) {
    return [...matches].sort((a, b) => inputPrice(a) - inputPrice(b))[0] ?? null;
  }

  return matches[0] ?? null;
}

export function fallbackChain(
  model: AiModel,
  models: AiModel[] = MODEL_SEEDS,
): AiModel[] {
  const byId = new Map(models.map((item) => [item.id, item]));
  const chain: AiModel[] = [];
  const seen = new Set<string>();
  let current: AiModel | null = model;

  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.fallbackId ? (byId.get(current.fallbackId) ?? null) : null;
  }

  return chain;
}
