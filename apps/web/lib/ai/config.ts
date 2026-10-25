export type AiProviderName = "fake" | "workers-ai";

export type AiConfig = {
  provider: AiProviderName;
  enabled: boolean;
  imagesEnabled: boolean;
  accountId: string;
  apiToken: string;
  gatewayId: string;
  creditNeurons: number;
  dailyCapCredits: number;
  usdPerNeuron: number;
};

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function aiConfig(): AiConfig {
  return {
    provider: process.env.AI_PROVIDER === "workers-ai" ? "workers-ai" : "fake",
    enabled: process.env.AI_ENABLED !== "false",
    imagesEnabled: process.env.AI_IMAGES_ENABLED === "true",
    accountId: process.env.CF_AI_ACCOUNT_ID ?? "",
    apiToken: process.env.CF_AI_API_TOKEN ?? "",
    gatewayId: process.env.AI_GATEWAY_ID ?? "",
    creditNeurons: integer(process.env.AI_CREDIT_NEURONS, 100),
    dailyCapCredits: integer(process.env.AI_DAILY_CAP_CREDITS, 5000),
    usdPerNeuron: number(process.env.AI_USD_PER_NEURON, 0.000011),
  };
}
