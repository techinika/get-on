import {
  adjustForContrast,
  bestTextOn,
  contrastRatio,
  deriveTokens,
  mix,
  type Theme,
  type ThemeColors,
} from "@get-on/blocks";
import { SYSTEM_TEMPLATES, type Composition, type TemplatePackage } from "@get-on/templates";
import { FEEL_FONTS } from "./fonts";
import { MOOD_PALETTES } from "./colour-vocabulary";
import type { DesignSpec, Requirement, RequirementStatus, ToneId } from "./spec";
import { verifyDesign } from "./verify";

export type DesignBrief = {
  businessType?: string;
  businessName?: string;
  goal?: string;
  teamId?: string;
  requestId?: string;
  language?: string;
};

export type DesignPlan = {
  planId?: "free" | "basic" | "pro" | "enterprise";
  maxPages?: number;
  allowedSections?: string[];
};

export type SectionPlanItem = {
  type: string;
  variant?: string;
  source: "template" | "added";
};

export type DesignReportItem = {
  requirementId: string;
  status: RequirementStatus;
  planned: unknown;
  evidence: string;
};

export type DesignReport = {
  items: DesignReportItem[];
  accuracy: number;
  unmet: DesignReportItem[];
  unsupported: { text: string; nearest?: string }[];
  weights: { must: 3; should: 2; nice: 1 };
};

export type DesignDecision = {
  archetype: string;
  compositionId: string;
  theme: Theme;
  header: NonNullable<Theme["header"]>;
  footer: NonNullable<Theme["footer"]>;
  heroLayout: string;
  heroProps: Record<string, unknown>;
  sectionPlan: SectionPlanItem[];
  pages: string[];
  requestedPageCount?: number;
  report: DesignReport;
};

export type DesignCheck = Omit<DesignDecision, "report">;

const SECTION_TYPE: Record<string, string> = {
  pricing: "pricing",
  gallery: "gallery",
  faq: "faq",
  team: "team",
  testimonials: "testimonials",
  map: "map",
  booking: "cta",
  menu: "menu",
  products: "products",
  services: "services",
  contact: "contact-form",
  stats: "stats",
  features: "features",
  logos: "logos",
  steps: "steps",
  cta: "cta",
  "before-after": "before-after",
  "image-text": "image-text",
};

const CONTENT_REQUIREMENTS = new Set<Requirement["kind"]>([
  "copy_mentions",
  "copy_avoids",
  "tone",
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hash(value: string): number {
  let out = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    out ^= value.charCodeAt(index);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

function homePage(composition: Composition) {
  return composition.pages.find((page) => page.isHome) ?? composition.pages[0]!;
}

function compositionFor(pkg: TemplatePackage, businessType?: string): Composition {
  return (
    pkg.compositions.find((composition) => composition.businessTypes?.includes(businessType as never)) ??
    pkg.compositions[0]!
  );
}

function templateScore(pkg: TemplatePackage, composition: Composition, spec: DesignSpec, brief: DesignBrief): number {
  if (spec.archetype === pkg.meta.slug) return 1000;
  let score = 0;
  if (brief.businessType && pkg.meta.businessTypes.includes(brief.businessType as never)) score += 8;
  if (composition.businessTypes?.includes(brief.businessType as never)) score += 4;
  const text = spec.rawText.toLowerCase();
  for (const tag of pkg.meta.tags) if (text.includes(tag.toLowerCase())) score += 2;
  const theme = composition.theme;
  const design = theme.design ?? {};
  if (spec.layout.hero) {
    const hero = homePage(composition).blocks.find((block) => block.type === "hero");
    if (String(hero?.props?.layout ?? "") === spec.layout.hero) score += 6;
  }
  if (spec.layout.header && String(theme.header?.style ?? "classic") === spec.layout.header) score += 4;
  if (spec.layout.footer && String(theme.footer?.layout ?? "simple") === spec.layout.footer) score += 3;
  if (spec.layout.rhythm && String(design.rhythm ?? "even") === spec.layout.rhythm) score += 2;
  if (spec.layout.density && String(theme.density ?? "comfortable") === spec.layout.density) score += 2;
  if (spec.layout.corners && String(theme.corners ?? "soft") === spec.layout.corners) score += 1;
  if (spec.fonts.feel) {
    const pair = FEEL_FONTS[spec.fonts.feel];
    if (theme.fonts?.heading.id === pair.heading || theme.fonts?.body.id === pair.body) score += 3;
  }
  for (const tone of spec.tone) {
    if (pkg.meta.tags.some((tag) => tag.toLowerCase().includes(tone))) score += 1;
  }
  return score;
}

function chooseArchetype(spec: DesignSpec, brief: DesignBrief): { pkg: TemplatePackage; composition: Composition; score: number } {
  const seed = hash(`${brief.teamId ?? ""}:${brief.requestId ?? spec.rawText}`);
  const scored = SYSTEM_TEMPLATES.map((pkg) => {
    const composition = compositionFor(pkg, brief.businessType);
    return { pkg, composition, score: templateScore(pkg, composition, spec, brief) };
  }).sort((a, b) => b.score - a.score || ((hash(a.pkg.meta.slug + seed) % 1000) - (hash(b.pkg.meta.slug + seed) % 1000)));
  return scored[0]!;
}

function darkColors(spec: DesignSpec, base: ThemeColors): ThemeColors {
  const primary = spec.palette.primary ?? base.primary;
  const background = spec.palette.background ?? mix("#0B0F14", primary, 0.08);
  return {
    primary,
    accent: spec.palette.accent ?? base.accent,
    background,
    text: spec.palette.text ?? "#E6EDF3",
    soft: spec.palette.soft ?? mix(background, "#FFFFFF", 0.07),
  };
}

function applyContrastProtection(spec: DesignSpec, colors: ThemeColors): { colors: ThemeColors; unmet: string | null } {
  const next = { ...colors };
  const user = new Set(spec.palette.userHex.map((value) => value.toLowerCase()));
  for (const role of ["primary", "accent", "background", "text", "soft"] as const) {
    const value = spec.palette[role];
    if (value) user.add(value.toLowerCase());
  }
  const isUserColour = (value: string) => user.has(value.toLowerCase());
  const pairs: Array<["text" | "background" | "soft", "text" | "background" | "soft", number]> = [
    ["text", "background", 4.5],
    ["text", "soft", 4.5],
  ];
  let unmet: string | null = null;
  for (const [foreground, background, target] of pairs) {
    if (contrastRatio(next[foreground], next[background]) >= target - 1e-6) continue;
    const fgUser = isUserColour(next[foreground]);
    const bgUser = isUserColour(next[background]);
    if (!fgUser) {
      next[foreground] = adjustForContrast(next[foreground], next[background], target);
    } else if (!bgUser) {
      next[background] = adjustForContrast(next[background], next[foreground], target);
    } else {
      unmet = `The colours ${next[foreground]} and ${next[background]} are kept as requested but do not meet the contrast target.`;
    }
  }
  for (const role of ["primary", "accent"] as const) {
    const label = bestTextOn(next[role]);
    if (contrastRatio(next[role], label) >= 4.5 - 1e-6 || isUserColour(next[role])) continue;
    next[role] = adjustForContrast(next[role], label, 4.5);
  }
  return { colors: next, unmet };
}

function themeFor(
  spec: DesignSpec,
  base: Theme,
  composition: Composition,
  brief: DesignBrief,
): { theme: Theme; heroLayout: string; heroProps: Record<string, unknown>; header: NonNullable<Theme["header"]>; footer: NonNullable<Theme["footer"]>; unmet: string | null } {
  const theme = clone(base);
  const baseColors = theme.colors ?? {
    primary: "#0B6B4F",
    accent: "#F59E0B",
    background: "#FFFBF7",
    text: "#1F1A17",
    soft: "#F0F7F4",
  };
  let colors: ThemeColors = { ...baseColors };
  for (const role of ["primary", "accent", "background", "text", "soft"] as const) {
    const value = spec.palette[role];
    if (value) colors[role] = value;
  }
  if (spec.palette.mode === "dark") colors = darkColors(spec, colors);
  else if (spec.palette.mood && !spec.palette.userHex.length) {
    colors = { ...colors, ...MOOD_PALETTES[spec.palette.mood] };
  }
  const protectedColours = applyContrastProtection(spec, colors);
  theme.colors = protectedColours.colors;
  theme.colorMode = spec.palette.mode === "dark" ? "dark" : "light";
  theme.presetId = null;

  if (spec.layout.density) theme.density = spec.layout.density;
  if (spec.layout.corners) theme.corners = spec.layout.corners;
  if (spec.layout.buttonShape || spec.layout.buttonStyle) {
    theme.buttons = {
      shape: theme.buttons?.shape ?? "soft",
      style: theme.buttons?.style ?? "solid",
      size: theme.buttons?.size ?? "normal",
      uppercase: theme.buttons?.uppercase ?? false,
      shadow: theme.buttons?.shadow ?? false,
      ...(spec.layout.buttonShape ? { shape: spec.layout.buttonShape } : {}),
      ...(spec.layout.buttonStyle ? { style: spec.layout.buttonStyle } : {}),
    };
  }
  theme.design = {
    ...(theme.design ?? {}),
    ...spec.design,
    ...(spec.layout.rhythm ? { rhythm: spec.layout.rhythm } : {}),
    ...(spec.layout.imageStyle ? { imageStyle: spec.layout.imageStyle } : {}),
  };

  const home = homePage(composition);
  const hero = home.blocks.find((block) => block.type === "hero");
  const heroProps = { ...(hero?.props ?? {}) };
  const heroLayout = spec.layout.hero ?? String(heroProps.layout ?? "split");
  heroProps.layout = heroLayout;
  if (spec.layout.align) heroProps.align = spec.layout.align;

  const feel = spec.fonts.feel ? FEEL_FONTS[spec.fonts.feel] : undefined;
  const headingId = spec.fonts.heading?.id ?? feel?.heading ?? theme.fonts?.heading.id;
  const bodyId = spec.fonts.body?.id ?? feel?.body ?? theme.fonts?.body.id;
  if (headingId || bodyId) {
    const heading = headingId ?? bodyId!;
    const body = bodyId ?? headingId!;
    theme.fonts = {
      heading: { id: heading, weight: spec.fonts.heading?.weight ?? theme.fonts?.heading.weight ?? 700 },
      body: { id: body, weight: spec.fonts.body?.weight ?? theme.fonts?.body.weight ?? 400 },
      scale: theme.fonts?.scale ?? "comfortable",
    };
  }

  const header = { ...(theme.header ?? {}) };
  if (spec.layout.header) header.style = spec.layout.header as NonNullable<Theme["header"]>["style"];
  if (
    header.style === "overlay" &&
    !["fullbleed", "card-over-image", "diagonal", "product-shot", "arch"].includes(heroLayout)
  ) {
    header.style = "classic";
  }
  theme.header = header;

  const footer = { ...(theme.footer ?? {}) };
  if (spec.layout.footer) footer.layout = spec.layout.footer as NonNullable<Theme["footer"]>["layout"];
  theme.footer = footer;

  return {
    theme,
    heroLayout,
    heroProps,
    header,
    footer,
    unmet: protectedColours.unmet,
  };
}

function sectionPlanFor(spec: DesignSpec, composition: Composition): SectionPlanItem[] {
  const home = homePage(composition);
  const plan: SectionPlanItem[] = home.blocks.map((block) => ({
    type: String(block.type),
    variant: block.props?.layout ? String(block.props.layout) : undefined,
    source: "template",
  }));
  const excluded = new Set(spec.sections.exclude.map((id) => SECTION_TYPE[id] ?? id));
  let filtered = plan.filter((item) => !excluded.has(item.type));
  for (const id of spec.sections.include) {
    const type = SECTION_TYPE[id] ?? id;
    if (!filtered.some((item) => item.type === type)) filtered.push({ type, source: "added" });
  }

  const order = (spec.sections.order ?? []).map((id) => SECTION_TYPE[id] ?? id);
  if (order.length) {
    const rank = new Map(order.map((id, index) => [id, index]));
    const rankOf = (item: SectionPlanItem) => rank.get(item.type) ?? rank.get(item.variant ?? "");
    const hero = filtered.filter((item) => item.type === "hero");
    const rest = filtered.filter((item) => item.type !== "hero");
    rest.sort((a, b) => {
      const aRank = rankOf(a);
      const bRank = rankOf(b);
      if (aRank === undefined && bRank === undefined) return 0;
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    });
    filtered = [...hero, ...rest];
  }

  return filtered;
}

function pagePlanFor(spec: DesignSpec, composition: Composition, plan: DesignPlan): string[] {
  const home = composition.pages.find((page) => page.isHome)?.key ?? composition.pages[0]?.key;
  const all = composition.pages.map((page) => page.key);
  const ordered = home ? [home, ...all.filter((key) => key !== home)] : all;
  const excluded = new Set(spec.pages.exclude);

  const required = home ? [home] : [];
  for (const id of spec.pages.include) {
    if (!required.includes(id)) required.push(id);
  }
  const requiredSet = new Set(required);
  const optional = ordered.filter((key) => !requiredSet.has(key) && !excluded.has(key));
  let pages = [...required, ...optional];

  const max = Math.max(1, plan.maxPages ?? (plan.planId === "free" ? 1 : 20));
  const requested = spec.pages.count;
  if (requested) {
    if (requested > required.length) {
      pages = pages.slice(0, requested);
      while (pages.length < requested) pages.push(`extra-page-${pages.length + 1}`);
    } else {
      pages = required;
    }
  }
  if (pages.length > max) pages = pages.slice(0, max);
  return pages;
}

function reportFor(spec: DesignSpec, decision: DesignCheck, contrastUnmet: string | null): DesignReport {
  const weights = { must: 3, should: 2, nice: 1 } as const;
  const checked = verifyDesign(spec, decision);
  const items: DesignReportItem[] = checked.items.map((item) => {
    const requirement = spec.requirements.find((entry) => entry.id === item.requirementId);
    if (requirement && CONTENT_REQUIREMENTS.has(requirement.kind)) {
      return {
        ...item,
        status: "met",
        evidence: "Will be checked after the copy is written.",
      };
    }
    if (
      contrastUnmet &&
      (item.requirementId === "contrast_ok:palette" || requirement?.kind === "contrast_ok")
    ) {
      return { ...item, status: "unmet", evidence: contrastUnmet };
    }
    return item;
  });
  const hasContrastRequirement = spec.requirements.some(
    (requirement) => requirement.kind === "contrast_ok",
  );
  const hasSyntheticContrast = items.some(
    (item) =>
      item.requirementId === "contrast_ok:palette" &&
      !spec.requirements.some((requirement) => requirement.id === item.requirementId),
  );
  if (contrastUnmet && !hasContrastRequirement && !hasSyntheticContrast) {
    items.push({
      requirementId: "contrast_ok:palette",
      status: "unmet",
      planned: "All text meets the contrast target",
      evidence: contrastUnmet,
    });
  }
  const syntheticContrast =
    items.some((item) => item.requirementId === "contrast_ok:palette") &&
    !hasContrastRequirement;
  const total =
    spec.requirements.reduce((sum, requirement) => sum + weights[requirement.strength], 0) +
    (syntheticContrast ? weights.must : 0);
  const met = spec.requirements.reduce((sum, requirement) => {
    const item = items.find((entry) => entry.requirementId === requirement.id);
    return sum + (item?.status === "met" ? weights[requirement.strength] : 0);
  }, 0);
  const unsupported = spec.unsupported.map((item) => ({ text: item.text, nearest: item.nearest }));
  return {
    items,
    accuracy: total === 0 ? 1 : met / total,
    unmet: items.filter((item) => item.status === "unmet"),
    unsupported,
    weights,
  };
}

export function resolveDesign(spec: DesignSpec, brief: DesignBrief = {}, plan: DesignPlan = {}): DesignDecision {
  const { pkg, composition } = chooseArchetype(spec, brief);
  const prepared = themeFor(spec, composition.theme, composition, brief);
  const sectionPlan = sectionPlanFor(spec, composition);
  const pages = pagePlanFor(spec, composition, plan);
  const base: DesignCheck = {
    archetype: pkg.meta.slug,
    compositionId: composition.id,
    theme: prepared.theme,
    header: prepared.header,
    footer: prepared.footer,
    heroLayout: prepared.heroLayout,
    heroProps: prepared.heroProps,
    sectionPlan,
    pages,
    requestedPageCount: spec.pages.count,
  };
  const report = reportFor(spec, base, prepared.unmet);
  return { ...base, report };
}

export function requirementStatusFor(requirement: Requirement, status: RequirementStatus, evidence: string): DesignReportItem {
  return { requirementId: requirement.id, status, planned: requirement.value, evidence };
}

export function toneSummary(tones: ToneId[]): string {
  return tones.length ? tones.join(", ") : "clear and natural";
}

export function verifyContrast(colors: ThemeColors): boolean {
  const tokens = deriveTokens(colors);
  return (
    contrastRatio(tokens["--s-text"]!, tokens["--s-bg"]!) >= 4.5 &&
    contrastRatio(tokens["--s-on-primary"]!, tokens["--s-primary"]!) >= 4.5 &&
    contrastRatio(tokens["--s-on-accent"]!, tokens["--s-accent"]!) >= 4.5
  );
}
