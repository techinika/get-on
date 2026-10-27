import { z } from "zod";
import type { ThemeDesign } from "@get-on/blocks";

export const DESIGN_SPEC_VERSION = 1 as const;

export const REQUIREMENT_KINDS = [
  "color_exact",
  "color_family",
  "mode",
  "font_exact",
  "font_feel",
  "hero_layout",
  "header_style",
  "footer_layout",
  "density",
  "rhythm",
  "corners",
  "button_shape",
  "button_style",
  "image_style",
  "alignment",
  "section_included",
  "section_excluded",
  "section_order",
  "page_included",
  "page_excluded",
  "page_count",
  "copy_mentions",
  "copy_avoids",
  "tone",
  "contrast_ok",
  "language",
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];
export type RequirementStrength = "must" | "should" | "nice";
export type RequirementSource = "user" | "inferred" | "default";
export type RequirementStatus = "met" | "unmet" | "unsupported";

export type RequirementValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string | number | boolean>;

export type Requirement = {
  id: string;
  kind: RequirementKind;
  target: string;
  value: RequirementValue;
  strength: RequirementStrength;
  source: RequirementSource;
  status?: RequirementStatus;
  evidence?: string;
};

export type MoodId =
  | "warm"
  | "cool"
  | "earthy"
  | "pastel"
  | "vibrant"
  | "muted"
  | "neon"
  | "luxury"
  | "fresh"
  | "natural"
  | "playful"
  | "corporate";

export type FeelId =
  | "elegant"
  | "modern"
  | "techy"
  | "friendly"
  | "bold"
  | "classic"
  | "quirky";

export type ToneId =
  | "friendly"
  | "professional"
  | "bold"
  | "calm"
  | "playful"
  | "elegant"
  | "warm"
  | "direct"
  | "luxury"
  | "technical";

export type FontRef = { id: string; weight?: number };

export type DesignSpec = {
  version: 1;
  rawText: string;
  language: string;
  requirements: Requirement[];
  palette: {
    primary?: string;
    accent?: string;
    background?: string;
    text?: string;
    soft?: string;
    mode: "light" | "dark" | "auto";
    mood?: MoodId;
    userHex: string[];
    avoid?: string[];
  };
  fonts: {
    heading?: FontRef;
    body?: FontRef;
    feel?: FeelId;
    avoid?: string[];
  };
  layout: {
    hero?: string;
    header?: string;
    footer?: string;
    density?: "compact" | "comfortable" | "airy";
    rhythm?: "even" | "alternate" | "tinted" | "bold";
    corners?: "sharp" | "soft" | "round";
    buttonShape?: "square" | "soft" | "round" | "pill";
    buttonStyle?: "solid" | "outline" | "soft";
    imageStyle?: "rounded" | "sharp" | "arch" | "offset" | "circle";
    align?: "left" | "center";
  };
  design: Partial<ThemeDesign>;
  sections: { include: string[]; exclude: string[]; order?: string[]; avoid?: string[] };
  pages: { include: string[]; exclude: string[]; count?: number };
  tone: ToneId[];
  copy: { mention: string[]; avoidWords: string[]; useWords: string[] };
  archetype?: string;
  unsupported: { text: string; nearest?: string }[];
  conflicts: { a: string; b: string; resolution: string }[];
  confidence: number;
  clarifications: { question: string; options: string[]; requirementId: string }[];
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour");

const requirementValue = z.union([
  z.string().max(200),
  z.number(),
  z.boolean(),
  z.array(z.string().max(100)).max(40),
  z.record(z.union([z.string().max(200), z.number(), z.boolean()])),
]);

export const requirementSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(REQUIREMENT_KINDS),
  target: z.string().min(1).max(80),
  value: requirementValue,
  strength: z.enum(["must", "should", "nice"]),
  source: z.enum(["user", "inferred", "default"]),
  status: z.enum(["met", "unmet", "unsupported"]).optional(),
  evidence: z.string().max(500).optional(),
});

export const designSpecSchema = z.object({
  version: z.literal(1),
  rawText: z.string().max(600),
  language: z.string().min(2).max(20),
  requirements: z.array(requirementSchema).max(40),
  palette: z.object({
    primary: hex.optional(),
    accent: hex.optional(),
    background: hex.optional(),
    text: hex.optional(),
    soft: hex.optional(),
    mode: z.enum(["light", "dark", "auto"]),
    mood: z
      .enum(["warm", "cool", "earthy", "pastel", "vibrant", "muted", "neon", "luxury", "fresh", "natural", "playful", "corporate"])
      .optional(),
    userHex: z.array(hex).max(20),
    avoid: z.array(z.string().max(40)).max(20).optional(),
  }),
  fonts: z.object({
    heading: z.object({ id: z.string().min(1).max(80), weight: z.number().int().min(100).max(900).optional() }).optional(),
    body: z.object({ id: z.string().min(1).max(80), weight: z.number().int().min(100).max(900).optional() }).optional(),
    feel: z.enum(["elegant", "modern", "techy", "friendly", "bold", "classic", "quirky"]).optional(),
    avoid: z.array(z.string().max(80)).max(20).optional(),
  }),
  layout: z.object({
    hero: z.string().max(40).optional(),
    header: z.string().max(40).optional(),
    footer: z.string().max(40).optional(),
    density: z.enum(["compact", "comfortable", "airy"]).optional(),
    rhythm: z.enum(["even", "alternate", "tinted", "bold"]).optional(),
    corners: z.enum(["sharp", "soft", "round"]).optional(),
    buttonShape: z.enum(["square", "soft", "round", "pill"]).optional(),
    buttonStyle: z.enum(["solid", "outline", "soft"]).optional(),
    imageStyle: z.enum(["rounded", "sharp", "arch", "offset", "circle"]).optional(),
    align: z.enum(["left", "center"]).optional(),
  }),
  design: z.record(z.unknown()),
  sections: z.object({
    include: z.array(z.string().max(60)).max(20),
    exclude: z.array(z.string().max(60)).max(20),
    order: z.array(z.string().max(60)).max(20).optional(),
    avoid: z.array(z.string().max(60)).max(20).optional(),
  }),
  pages: z.object({
    include: z.array(z.string().max(60)).max(20),
    exclude: z.array(z.string().max(60)).max(20),
    count: z.number().int().min(1).max(30).optional(),
  }),
  tone: z.array(z.enum(["friendly", "professional", "bold", "calm", "playful", "elegant", "warm", "direct", "luxury", "technical"])).max(3),
  copy: z.object({
    mention: z.array(z.string().max(80)).max(20),
    avoidWords: z.array(z.string().max(80)).max(20),
    useWords: z.array(z.string().max(80)).max(20),
  }),
  archetype: z.string().max(80).optional(),
  unsupported: z.array(z.object({ text: z.string().max(200), nearest: z.string().max(200).optional() })).max(20),
  conflicts: z.array(z.object({ a: z.string().max(200), b: z.string().max(200), resolution: z.string().max(300) })).max(20),
  confidence: z.number().min(0).max(1),
  clarifications: z
    .array(z.object({ question: z.string().max(200), options: z.array(z.string().max(80)).min(2).max(6), requirementId: z.string().max(80) }))
    .max(2),
});

export type RequirementInput = Omit<Requirement, "id"> & { id?: string };

export function normaliseHex(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(raw);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

export function requirement(input: RequirementInput): Requirement {
  return { ...input, id: input.id ?? `${input.kind}:${input.target}` };
}

export function emptyDesignSpec(rawText = ""): DesignSpec {
  return {
    version: 1,
    rawText: rawText.slice(0, 600),
    language: "en",
    requirements: [],
    palette: { mode: "light", userHex: [] },
    fonts: {},
    layout: {},
    design: {},
    sections: { include: [], exclude: [] },
    pages: { include: [], exclude: [] },
    tone: [],
    copy: { mention: [], avoidWords: [], useWords: [] },
    unsupported: [],
    conflicts: [],
    confidence: 0,
    clarifications: [],
  };
}

export function parseDesignSpec(value: unknown): DesignSpec {
  return designSpecSchema.parse(value) as DesignSpec;
}
