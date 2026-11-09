import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import env from "@/lib/env";
import { loadAiSettings } from "@/lib/ai/settings";
import {
  ASSISTANT_DEFAULT_WIDTH,
  type AssistantTab,
} from "./constants";

export type AssistantFeature = {
  enabled: boolean;
  confirmCredits: number;
  turnCapCredits: number;
  initialOpen: boolean;
  initialTab: AssistantTab;
  initialWidth: number;
};

const DISABLED_FEATURE: AssistantFeature = {
  enabled: false,
  confirmCredits: 5,
  turnCapCredits: 3,
  initialOpen: false,
  initialTab: "assistant",
  initialWidth: ASSISTANT_DEFAULT_WIDTH,
};

/**
 * The global feature flag plus the admin kill switch. The value is cached for
 * one request so the shell and the API agree.
 */
export const getAssistantFeature = cache(async (): Promise<AssistantFeature> => {
  if (!env.assistantEnabled) return DISABLED_FEATURE;

  try {
    const admin = createAdminClient();
    const settings = await loadAiSettings(admin);
    return {
      enabled: settings.enabled && settings.assistantEnabled,
      confirmCredits: settings.assistantConfirmCredits,
      turnCapCredits: settings.assistantTurnCapCredits,
      initialOpen: false,
      initialTab: "assistant",
      initialWidth: ASSISTANT_DEFAULT_WIDTH,
    };
  } catch (error) {
    console.error("[agent] could not load assistant settings", error);
    return DISABLED_FEATURE;
  }
});
