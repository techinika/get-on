import { hexToOklch } from "@get-on/blocks";
import { SYSTEM_TEMPLATES } from "@get-on/templates";
import { resolveDesign, type DesignBrief, type DesignDecision, type DesignPlan } from "./resolve";
import type { DesignSpec, MoodId } from "./spec";

export type DesignHistoryEntry = {
  archetype: string;
  hero: string;
  paletteFamily: string;
  fontPair: string;
  header: string;
  rhythm?: string;
  createdAt?: string;
};

export function designSeed(teamId: string, requestId: string): number {
  let out = 2166136261;
  for (const value of `${teamId}:${requestId}`) {
    out ^= value.charCodeAt(0);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

export function paletteFamily(hex: string): string {
  const colour = hexToOklch(hex);
  if (colour.c < 0.035) return "neutral";
  const hue = ((colour.h % 360) + 360) % 360;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40) return "orange";
  if (hue < 70) return "gold";
  if (hue < 95) return "yellow";
  if (hue < 165) return "green";
  if (hue < 200) return "teal";
  if (hue < 245) return "blue";
  if (hue < 275) return "indigo";
  if (hue < 320) return "purple";
  return "pink";
}

export function variationKey(decision: DesignDecision): string {
  return [
    decision.archetype,
    decision.heroLayout,
    paletteFamily(decision.theme.colors?.primary ?? "#000000"),
    `${decision.theme.fonts?.heading.id ?? ""}/${decision.theme.fonts?.body.id ?? ""}`,
    String(decision.header.style ?? "classic"),
  ].join(":");
}

export function historyEntry(decision: DesignDecision): DesignHistoryEntry {
  return {
    archetype: decision.archetype,
    hero: decision.heroLayout,
    paletteFamily: paletteFamily(decision.theme.colors?.primary ?? "#000000"),
    fontPair: `${decision.theme.fonts?.heading.id ?? ""}/${decision.theme.fonts?.body.id ?? ""}`,
    header: String(decision.header.style ?? "classic"),
    rhythm: String(decision.theme.design?.rhythm ?? "even"),
    createdAt: new Date().toISOString(),
  };
}

function recentKeys(history: DesignHistoryEntry[]): Set<string> {
  return new Set(history.slice(-5).map((entry) => [entry.archetype, entry.hero, entry.paletteFamily, entry.fontPair, entry.header].join(":")));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function archetypeOrder(brief: DesignBrief): string[] {
  return [...SYSTEM_TEMPLATES]
    .sort((a, b) => {
      const af = brief.businessType && a.meta.businessTypes.includes(brief.businessType as never) ? 1 : 0;
      const bf = brief.businessType && b.meta.businessTypes.includes(brief.businessType as never) ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.meta.slug.localeCompare(b.meta.slug);
    })
    .map((pkg) => pkg.meta.slug);
}

const HEROES = ["split", "editorial", "centered", "minimal", "fullbleed", "arch", "diagonal", "card-over-image", "offset-frame", "product-shot"];
const HEADERS = ["classic", "minimal", "centered", "split", "overlay"];
const MOODS: MoodId[] = ["warm", "cool", "earthy", "fresh", "playful", "corporate", "luxury", "pastel"];

export function resolveDesignOptions(
  spec: DesignSpec,
  brief: DesignBrief = {},
  plan: DesignPlan = {},
  options: { count?: number; history?: DesignHistoryEntry[] } = {},
): DesignDecision[] {
  const count = Math.max(1, Math.min(options.count ?? 3, 5));
  const recent = recentKeys(options.history ?? []);
  const base = resolveDesign(spec, brief, plan);
  const chosen: DesignDecision[] = [base];
  const keys = new Set([variationKey(base)]);
  const archetypes = spec.archetype ? [spec.archetype] : archetypeOrder(brief);

  for (let index = 0; chosen.length < count && index < 30; index += 1) {
    const variant = clone(spec);
    const archetype = spec.archetype ?? archetypes[index % archetypes.length]!;
    variant.archetype = archetype;
    if (!spec.layout.hero) variant.layout.hero = HEROES[index % HEROES.length]!;
    if (!spec.layout.header) variant.layout.header = HEADERS[index % HEADERS.length]!;
    if (!spec.palette.userHex.length && !spec.palette.mood) variant.palette.mood = MOODS[index % MOODS.length]!;
    const decision = resolveDesign(variant, { ...brief, requestId: `${brief.requestId ?? ""}:${index + 1}` }, plan);
    const key = variationKey(decision);
    if (keys.has(key) || recent.has(key)) continue;
    keys.add(key);
    chosen.push(decision);
  }

  const seed = designSeed(brief.teamId ?? "", brief.requestId ?? spec.rawText);
  return chosen.sort((a, b) => (seed + a.archetype.length) % 7 - (seed + b.archetype.length) % 7);
}

export function resolveDesignWithHistory(
  spec: DesignSpec,
  brief: DesignBrief = {},
  plan: DesignPlan = {},
  history: DesignHistoryEntry[] = [],
): DesignDecision {
  const options = resolveDesignOptions(spec, brief, plan, { count: 3, history });
  return chooseVariation(options, designSeed(brief.teamId ?? "", brief.requestId ?? spec.rawText), history);
}

export function chooseVariation(candidates: DesignDecision[], seed: number, history: DesignHistoryEntry[] = []): DesignDecision {
  if (!candidates.length) throw new Error("NO_DESIGN_OPTIONS");
  const recent = recentKeys(history);
  const bestAccuracy = Math.max(...candidates.map((candidate) => candidate.report.accuracy));
  const withinTolerance = candidates.filter((candidate) => candidate.report.accuracy >= bestAccuracy - 0.05);
  const fresh = withinTolerance.filter((candidate) => !recent.has(variationKey(candidate)));
  const pool = fresh.length ? fresh : withinTolerance;
  return pool[seed % pool.length]!;
}
