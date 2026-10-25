import type { AiModel, AiUsage, CreditSettings } from "../types";

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  creditNeurons: 100,
  usdPerNeuron: 0.000011,
};

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && value !== undefined && value > 0 ? value : 0;
}

export function usageToNeurons(
  usage: AiUsage,
  model: Pick<
    AiModel,
    "neuronsPerMInput" | "neuronsPerMOutput" | "neuronsPerImage"
  >,
): number {
  if (usage.neurons !== undefined && Number.isFinite(usage.neurons)) {
    return Math.max(0, usage.neurons);
  }

  const inputTokens = finiteNonNegative(usage.inputTokens);
  const outputTokens = finiteNonNegative(usage.outputTokens);
  const images = finiteNonNegative(usage.images);
  const inputRate = finiteNonNegative(model.neuronsPerMInput ?? undefined);
  const outputRate = finiteNonNegative(model.neuronsPerMOutput ?? undefined);
  const imageRate = finiteNonNegative(model.neuronsPerImage ?? undefined);

  return (
    (inputTokens * inputRate) / 1_000_000 +
    (outputTokens * outputRate) / 1_000_000 +
    images * imageRate
  );
}

export function neuronsToCredits(
  neurons: number,
  creditNeurons = DEFAULT_CREDIT_SETTINGS.creditNeurons,
): number {
  if (!Number.isFinite(neurons) || neurons <= 0) return 0;
  return neurons / creditNeurons;
}

export function ceilCredits(credits: number): number {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return Math.ceil(credits);
}

export function chargeCredits(
  neurons: number,
  settings: CreditSettings = DEFAULT_CREDIT_SETTINGS,
): number {
  return Math.max(1, ceilCredits(neuronsToCredits(neurons, settings.creditNeurons)));
}

export function actualCredits(
  usage: AiUsage,
  model: Pick<
    AiModel,
    "neuronsPerMInput" | "neuronsPerMOutput" | "neuronsPerImage"
  >,
  success: boolean,
  settings: CreditSettings = DEFAULT_CREDIT_SETTINGS,
): number {
  if (!success) return 0;
  return chargeCredits(usageToNeurons(usage, model), settings);
}

export type EstimateInput = {
  inputTokens: number;
  expectedOutputTokens: number;
  model: Pick<AiModel, "neuronsPerMInput" | "neuronsPerMOutput">;
  creditNeurons?: number;
  repairFactor?: number;
  minimum?: number;
};

export function estimateCredits(input: EstimateInput): number {
  const creditNeurons =
    input.creditNeurons ?? DEFAULT_CREDIT_SETTINGS.creditNeurons;
  const repairFactor = input.repairFactor ?? 1.2;
  const minimum = input.minimum ?? 1;
  const neurons =
    (finiteNonNegative(input.inputTokens) *
      finiteNonNegative(input.model.neuronsPerMInput ?? undefined)) /
      1_000_000 +
    (finiteNonNegative(input.expectedOutputTokens) *
      finiteNonNegative(input.model.neuronsPerMOutput ?? undefined)) /
      1_000_000;

  if (neurons <= 0) return minimum;

  return Math.max(minimum, Math.ceil((neurons / creditNeurons) * repairFactor));
}

export function reserveCredits(estimate: number, cap: number): number {
  if (!Number.isFinite(estimate) || estimate <= 0) return 0;
  const safeCap = Number.isFinite(cap) && cap > 0 ? cap : 0;
  const wanted = Math.ceil(estimate * 1.5);
  return safeCap > 0 ? Math.min(wanted, safeCap) : wanted;
}

export function creditRange(
  estimate: number,
  cap: number,
): { low: number; high: number } {
  return {
    low: Math.max(0, Math.ceil(estimate * 0.7)),
    high: reserveCredits(estimate, cap),
  };
}

export function usdToNeurons(
  usd: number,
  usdPerNeuron = DEFAULT_CREDIT_SETTINGS.usdPerNeuron,
): number {
  if (!Number.isFinite(usd) || usd <= 0 || usdPerNeuron <= 0) return 0;
  return usd / usdPerNeuron;
}

export type ImageCostInput = {
  width: number;
  height: number;
  steps: number;
};

export function imageNeurons(input: ImageCostInput): number {
  const width = Math.max(1, Math.ceil(input.width));
  const height = Math.max(1, Math.ceil(input.height));
  const steps = Math.max(1, Math.ceil(input.steps));
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  return 4.8 * tiles + 9.6 * steps * tiles;
}

export function imageCredits(
  input: ImageCostInput,
  creditNeurons = DEFAULT_CREDIT_SETTINGS.creditNeurons,
): number {
  return Math.max(1, ceilCredits(neuronsToCredits(imageNeurons(input), creditNeurons)));
}
