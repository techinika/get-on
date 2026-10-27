import { HERO_LAYOUTS, DESIGN_OPTIONS } from "@get-on/blocks";
import type { DesignSpec, FeelId } from "@get-on/ai";
import type { DesignInterpretation } from "./design-schema";

export const DESIGN_STYLES = [
  "Modern",
  "Minimal",
  "Bold",
  "Warm",
  "Elegant",
  "Playful",
  "Classic",
  "Technical",
] as const;

export const DESIGN_SECTIONS = [
  "About",
  "Services",
  "Products",
  "Gallery",
  "Pricing",
  "Testimonials",
  "Team",
  "FAQ",
  "Contact",
  "Booking",
] as const;

export const DESIGN_FEELS: FeelId[] = [
  "modern",
  "elegant",
  "friendly",
  "bold",
  "classic",
  "techy",
  "quirky",
];

export type DesignPrefs = {
  styles: string[];
  primary: string | null;
  accent: string | null;
  background: "auto" | "light" | "dark";
  fontFeel: FeelId | null;
  fontName: string | null;
  hero: string | null;
  density: "compact" | "comfortable" | "airy" | null;
  corners: "sharp" | "soft" | "round" | null;
  buttonShape: "square" | "soft" | "round" | "pill" | null;
  include: string[];
  exclude: string[];
};

export const EMPTY_DESIGN_PREFS: DesignPrefs = {
  styles: [],
  primary: null,
  accent: null,
  background: "auto",
  fontFeel: null,
  fontName: null,
  hero: null,
  density: null,
  corners: null,
  buttonShape: null,
  include: [],
  exclude: [],
};

const HERO_IDS = new Set(HERO_LAYOUTS.map((item) => item.id));
const DENSITY_IDS = new Set(DESIGN_OPTIONS.density.map((item) => item.id));
const CORNER_IDS = new Set(DESIGN_OPTIONS.corners.map((item) => item.id));
const BUTTON_IDS = new Set(DESIGN_OPTIONS.buttons.map((item) => item.id));
const FEEL_IDS = new Set<string>(DESIGN_FEELS);
const STYLE_IDS = new Set<string>(DESIGN_STYLES);
const SECTION_IDS = new Set<string>(DESIGN_SECTIONS);

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function text(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T | null = null,
): T | null {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function stringList(
  value: unknown,
  allowed?: Set<string>,
  max = 8,
): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  for (const item of value) {
    const clean = text(item, 40);
    if (!clean || (allowed && !allowed.has(clean))) continue;
    if (output.some((entry) => entry.toLowerCase() === clean.toLowerCase())) continue;
    output.push(clean);
    if (output.length >= max) break;
  }
  return output;
}

export function parseDesignPrefs(value: unknown): DesignPrefs {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    styles: stringList(input.styles, STYLE_IDS, 3),
    primary: isHex(input.primary) ? input.primary : null,
    accent: isHex(input.accent) ? input.accent : null,
    background:
      input.background === "light" || input.background === "dark"
        ? input.background
        : "auto",
    fontFeel: oneOf<FeelId>(input.fontFeel, FEEL_IDS),
    fontName: text(input.fontName, 60),
    hero: oneOf(input.hero, HERO_IDS),
    density: oneOf(input.density, DENSITY_IDS),
    corners: oneOf(input.corners, CORNER_IDS),
    buttonShape: oneOf(input.buttonShape, BUTTON_IDS),
    include: stringList(input.include, SECTION_IDS),
    exclude: stringList(input.exclude, SECTION_IDS),
  };
}

export function parseDesignPrefsForm(formData: FormData): DesignPrefs {
  const value = formData.get("design_prefs");
  if (typeof value === "string" && value) {
    try {
      return parseDesignPrefs(JSON.parse(value));
    } catch {
      return EMPTY_DESIGN_PREFS;
    }
  }
  return EMPTY_DESIGN_PREFS;
}

export function designPrefsAreEmpty(prefs: DesignPrefs): boolean {
  return (
    prefs.styles.length === 0 &&
    !prefs.primary &&
    !prefs.accent &&
    prefs.background === "auto" &&
    !prefs.fontFeel &&
    !prefs.fontName &&
    !prefs.hero &&
    !prefs.density &&
    !prefs.corners &&
    !prefs.buttonShape &&
    prefs.include.length === 0 &&
    prefs.exclude.length === 0
  );
}

export function designPrefsToText(prefs: DesignPrefs): string {
  const parts: string[] = [];
  if (prefs.styles.length) parts.push(`${prefs.styles.join(", ")} look.`);
  if (prefs.primary) parts.push(`Main colour ${prefs.primary}.`);
  if (prefs.accent) parts.push(`Accent colour ${prefs.accent}.`);
  if (prefs.background !== "auto") parts.push(`${prefs.background} background.`);
  if (prefs.fontFeel) parts.push(`${prefs.fontFeel} fonts.`);
  if (prefs.fontName) parts.push(`Use ${prefs.fontName} for headings.`);
  if (prefs.hero) parts.push(`${prefs.hero} hero.`);
  if (prefs.density) parts.push(`${prefs.density} spacing.`);
  if (prefs.corners) parts.push(`${prefs.corners} corners.`);
  if (prefs.buttonShape) parts.push(`${prefs.buttonShape} buttons.`);
  if (prefs.include.length) parts.push(`Include ${prefs.include.join(", ")}.`);
  if (prefs.exclude.length) parts.push(`Leave out ${prefs.exclude.join(", ")}.`);
  return parts.join(" ");
}

export function applyDesignPrefsAsDefaults(
  spec: DesignSpec,
  prefs: DesignPrefs,
): DesignSpec {
  if (!spec.palette.primary && prefs.primary) spec.palette.primary = prefs.primary;
  if (!spec.palette.accent && prefs.accent) spec.palette.accent = prefs.accent;
  const askedMode = spec.requirements.some((item) => item.kind === "mode");
  if (!askedMode && prefs.background !== "auto") {
    spec.palette.mode = prefs.background;
  }
  if (!spec.fonts.feel && prefs.fontFeel) spec.fonts.feel = prefs.fontFeel;
  if (!spec.fonts.heading && prefs.fontName) spec.fonts.heading = { id: prefs.fontName };
  if (!spec.fonts.body && prefs.fontName) spec.fonts.body = { id: prefs.fontName };
  if (!spec.layout.hero && prefs.hero) spec.layout.hero = prefs.hero;
  if (!spec.layout.density && prefs.density) spec.layout.density = prefs.density;
  if (!spec.layout.corners && prefs.corners) spec.layout.corners = prefs.corners;
  if (!spec.layout.buttonShape && prefs.buttonShape) {
    spec.layout.buttonShape = prefs.buttonShape;
  }
  if (prefs.include.length) {
    spec.sections.include = [
      ...new Set([...spec.sections.include, ...prefs.include.map((s) => s.toLowerCase())]),
    ];
  }
  if (prefs.exclude.length) {
    spec.sections.exclude = [
      ...new Set([...spec.sections.exclude, ...prefs.exclude.map((s) => s.toLowerCase())]),
    ];
  }
  return spec;
}

export function applyDesignPrefs(spec: DesignSpec, prefs: DesignPrefs): DesignSpec {
  if (prefs.primary) spec.palette.primary = prefs.primary;
  if (prefs.accent) spec.palette.accent = prefs.accent;
  if (prefs.background !== "auto") spec.palette.mode = prefs.background;
  if (prefs.fontFeel) spec.fonts.feel = prefs.fontFeel;
  if (prefs.fontName) {
    spec.fonts.heading = { id: prefs.fontName };
    if (!spec.fonts.body) spec.fonts.body = { id: prefs.fontName };
  }
  if (prefs.hero) spec.layout.hero = prefs.hero;
  if (prefs.density) spec.layout.density = prefs.density;
  if (prefs.corners) spec.layout.corners = prefs.corners;
  if (prefs.buttonShape) spec.layout.buttonShape = prefs.buttonShape;
  if (prefs.include.length) {
    spec.sections.include = [
      ...new Set([...spec.sections.include, ...prefs.include.map((s) => s.toLowerCase())]),
    ];
  }
  if (prefs.exclude.length) {
    spec.sections.exclude = [
      ...new Set([...spec.sections.exclude, ...prefs.exclude.map((s) => s.toLowerCase())]),
    ];
  }
  return spec;
}

function mergeRequirements(
  spec: DesignSpec,
  interpretation: DesignInterpretation,
): DesignSpec {
  const seen = new Set(spec.requirements.map((item) => `${item.kind}:${item.target}`));
  for (const item of interpretation.requirements) {
    const key = `${item.kind}:${item.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spec.requirements.push({
      id: `model-${spec.requirements.length + 1}`,
      kind: item.kind,
      target: item.target,
      value: item.value,
      strength: item.strength,
      source: "inferred",
      evidence: item.evidence,
    });
  }
  return spec;
}

export function mergeDesignInterpretation(
  spec: DesignSpec,
  interpretation: DesignInterpretation,
): DesignSpec {
  mergeRequirements(spec, interpretation);
  const palette = interpretation.palette;
  if (!spec.palette.primary && palette.primary) spec.palette.primary = palette.primary;
  if (!spec.palette.accent && palette.accent) spec.palette.accent = palette.accent;
  if (!spec.palette.background && palette.background) spec.palette.background = palette.background;
  if (!spec.palette.text && palette.text) spec.palette.text = palette.text;
  if (!spec.palette.soft && palette.soft) spec.palette.soft = palette.soft;
  if (palette.mood) spec.palette.mood = palette.mood;
  if (palette.mode) spec.palette.mode = palette.mode;
  if (!spec.fonts.feel && interpretation.fonts.feel) spec.fonts.feel = interpretation.fonts.feel;
  if (!spec.fonts.heading && interpretation.fonts.heading) {
    spec.fonts.heading = { id: interpretation.fonts.heading };
  }
  if (!spec.fonts.body && interpretation.fonts.body) {
    spec.fonts.body = { id: interpretation.fonts.body };
  }
  const layout = interpretation.layout;
  for (const key of [
    "hero",
    "header",
    "footer",
    "density",
    "rhythm",
    "corners",
    "buttonShape",
    "buttonStyle",
    "imageStyle",
    "align",
  ] as const) {
    if (!spec.layout[key] && layout[key]) {
      (spec.layout as Record<string, string>)[key] = layout[key] as string;
    }
  }
  if (interpretation.sections.include.length && spec.sections.include.length === 0) {
    spec.sections.include = interpretation.sections.include;
  }
  if (interpretation.sections.exclude.length) {
    spec.sections.exclude = [...new Set([...spec.sections.exclude, ...interpretation.sections.exclude])];
  }
  if (interpretation.pages.include.length && spec.pages.include.length === 0) {
    spec.pages.include = interpretation.pages.include;
  }
  if (interpretation.pages.exclude.length) {
    spec.pages.exclude = [...new Set([...spec.pages.exclude, ...interpretation.pages.exclude])];
  }
  if (!spec.pages.count && interpretation.pages.count) spec.pages.count = interpretation.pages.count;
  if (interpretation.unsupported.length) spec.unsupported = interpretation.unsupported;
  if (interpretation.clarifications.length) {
    spec.clarifications = interpretation.clarifications.map((item, index) => ({
      ...item,
      requirementId: `clarification-${index + 1}`,
    }));
  }
  spec.confidence = Math.max(spec.confidence, interpretation.confidence);
  return spec;
}
