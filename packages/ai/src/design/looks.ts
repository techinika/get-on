import { resolveDesignOptions, variationKey, type DesignHistoryEntry } from "./variation";
import type { DesignBrief, DesignDecision, DesignPlan } from "./resolve";
import type { DesignSpec } from "./spec";

export type DesignLook = {
  id: string;
  name: string;
  description: string;
  decision: DesignDecision;
  key: string;
};

const NAMES = ["The confident one", "The calm one", "The bold one", "The warm one", "The editorial one"];

function describe(decision: DesignDecision): string {
  const colours = decision.theme.colors;
  return `${decision.heroLayout} hero, ${decision.header.style ?? "classic"} header and ${colours?.primary ?? "brand"} as the main colour.`;
}

export function designLooks(
  spec: DesignSpec,
  brief: DesignBrief = {},
  plan: DesignPlan = {},
  options: { count?: number; history?: DesignHistoryEntry[] } = {},
): DesignLook[] {
  const count = Math.max(3, Math.min(options.count ?? 3, 5));
  const decisions = resolveDesignOptions(spec, brief, plan, { count, history: options.history });
  return decisions.map((decision, index) => ({
    id: `look-${index + 1}`,
    name: NAMES[index] ?? `Look ${index + 1}`,
    description: describe(decision),
    decision,
    key: variationKey(decision),
  }));
}
