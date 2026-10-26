import { FakeAiProvider, type AiProvider } from "@get-on/ai";
import { aiConfig, type AiConfig } from "./config";
import { WorkersAiProvider } from "./provider";

export function createAiProvider(config: AiConfig = aiConfig()): AiProvider {
  if (config.provider === "fake") {
    return new FakeAiProvider();
  }
  return new WorkersAiProvider({
    accountId: config.accountId,
    apiToken: config.apiToken,
    gatewayId: config.gatewayId,
  });
}
