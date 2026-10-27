import { contrastRatio, deriveTokens, hexToOklch, luminance } from "@get-on/blocks";
import { FONT_CATALOGUE } from "./fonts";
import type { DesignDecision, DesignReportItem } from "./resolve";
import type { DesignSpec, Requirement, RequirementStatus } from "./spec";

export type DesignContent = {
  text?: string;
  pages?: Record<string, string>;
};

export type VerifyResult = {
  items: DesignReportItem[];
  accuracy: number;
  unmet: DesignReportItem[];
  unsupported: { text: string; nearest?: string }[];
  weights: { must: 3; should: 2; nice: 1 };
};

const WEIGHTS = { must: 3, should: 2, nice: 1 } as const;

const TONE_MARKERS: Record<string, string[]> = {
  friendly: ["you", "we", "hello", "welcome", "help", "easy", "happy"],
  professional: ["we", "our", "service", "experience", "quality", "trusted"],
  bold: ["make", "now", "start", "grow", "build", "stand out"],
  calm: ["calm", "quiet", "simple", "gentle", "space", "breathe"],
  playful: ["fun", "enjoy", "love", "happy", "bright", "let"],
  elegant: ["refined", "considered", "crafted", "beautiful", "timeless"],
  warm: ["welcome", "warm", "home", "together", "care"],
  direct: ["get", "book", "call", "find", "start", "clear"],
  luxury: ["exclusive", "premium", "bespoke", "refined", "signature"],
  technical: ["build", "system", "data", "fast", "reliable", "code"],
};

function familyOf(hex: string): string {
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

function textOf(content?: DesignContent): string {
  if (!content) return "";
  const pages = Object.values(content.pages ?? {}).join(" ");
  return `${content.text ?? ""} ${pages}`.toLowerCase();
}

function normalised(value: string): string {
  return value.trim().toLowerCase();
}

function checkRequirement(requirement: Requirement, decision: DesignDecision, content?: DesignContent): { status: RequirementStatus; evidence: string } {
  const value = requirement.value;
  const theme = decision.theme;
  const design = theme.design ?? {};
  switch (requirement.kind) {
    case "color_exact": {
      const target = requirement.target as "primary" | "accent" | "background" | "text" | "soft";
      const actual = theme.colors?.[target];
      const wanted = String(value).toLowerCase();
      return actual?.toLowerCase() === wanted
        ? { status: "met", evidence: `${target} is ${actual}.` }
        : { status: "unmet", evidence: `${target} is ${actual ?? "not set"}; requested ${wanted}.` };
    }
    case "color_family": {
      const target = requirement.target === "accent" ? "accent" : "primary";
      const actual = theme.colors?.[target];
      if (!actual) return { status: "unmet", evidence: "No colour is set." };
      const family = familyOf(actual);
      return family === normalised(String(value))
        ? { status: "met", evidence: `${target} is in the ${family} family.` }
        : { status: "unmet", evidence: `${target} is ${family}, not ${String(value)}.` };
    }
    case "mode": {
      const dark = theme.colorMode === "dark" || (theme.colors ? luminance(theme.colors.background) < 0.2 : false);
      const wanted = String(value) === "dark";
      return dark === wanted ? { status: "met", evidence: `${wanted ? "Dark" : "Light"} mode applied.` } : { status: "unmet", evidence: `Expected ${String(value)} mode.` };
    }
    case "font_exact": {
      const target = requirement.target === "body" ? "body" : "heading";
      const actual = theme.fonts?.[target].id;
      return actual === String(value) ? { status: "met", evidence: `${target} font is ${actual}.` } : { status: "unmet", evidence: `${target} font is ${actual ?? "not set"}.` };
    }
    case "font_feel": {
      const feel = normalised(String(value));
      const ids = [theme.fonts?.heading.id, theme.fonts?.body.id].filter(Boolean);
      const matched = ids.some((id) => FONT_CATALOGUE.find((entry) => entry.id === id)?.feels.includes(feel as never));
      return matched ? { status: "met", evidence: `Fonts feel ${feel}.` } : { status: "unmet", evidence: `Fonts do not feel ${feel}.` };
    }
    case "hero_layout":
      return decision.heroLayout === String(value) ? { status: "met", evidence: `Hero is ${decision.heroLayout}.` } : { status: "unmet", evidence: `Hero is ${decision.heroLayout}.` };
    case "header_style":
      return String(decision.header.style) === String(value) ? { status: "met", evidence: `Header is ${String(decision.header.style)}.` } : { status: "unmet", evidence: `Header is ${String(decision.header.style)}.` };
    case "footer_layout":
      return String(decision.footer.layout) === String(value) ? { status: "met", evidence: `Footer is ${String(decision.footer.layout)}.` } : { status: "unmet", evidence: `Footer is ${String(decision.footer.layout)}.` };
    case "density":
      return String(theme.density ?? "comfortable") === String(value) ? { status: "met", evidence: `Density is ${String(theme.density ?? "comfortable")}.` } : { status: "unmet", evidence: `Density is ${String(theme.density ?? "comfortable")}.` };
    case "rhythm":
      return String(design.rhythm ?? "even") === String(value) ? { status: "met", evidence: `Rhythm is ${String(design.rhythm ?? "even")}.` } : { status: "unmet", evidence: `Rhythm is ${String(design.rhythm ?? "even")}.` };
    case "corners":
      return String(theme.corners ?? "soft") === String(value) ? { status: "met", evidence: `Corners are ${String(theme.corners ?? "soft")}.` } : { status: "unmet", evidence: `Corners are ${String(theme.corners ?? "soft")}.` };
    case "button_shape":
      return String(theme.buttons?.shape ?? "soft") === String(value) ? { status: "met", evidence: `Buttons are ${String(theme.buttons?.shape ?? "soft")}.` } : { status: "unmet", evidence: `Buttons are ${String(theme.buttons?.shape ?? "soft")}.` };
    case "button_style":
      return String(theme.buttons?.style ?? "solid") === String(value) ? { status: "met", evidence: `Buttons are ${String(theme.buttons?.style ?? "solid")}.` } : { status: "unmet", evidence: `Buttons are ${String(theme.buttons?.style ?? "solid")}.` };
    case "image_style":
      if (String(value) === "none") {
        const hasImage = decision.sectionPlan.some((item) => ["image-text", "gallery", "hero"].includes(item.type));
        return hasImage ? { status: "unmet", evidence: "The design still uses images." } : { status: "met", evidence: "No images are used." };
      }
      return String(design.imageStyle ?? "rounded") === String(value) ? { status: "met", evidence: `Images are ${String(design.imageStyle ?? "rounded")}.` } : { status: "unmet", evidence: `Images are ${String(design.imageStyle ?? "rounded")}.` };
    case "alignment": {
      const actual = String(decision.heroProps.align ?? "left");
      return actual === String(value) ? { status: "met", evidence: `Hero text is ${actual} aligned.` } : { status: "unmet", evidence: `Hero text is ${actual} aligned.` };
    }
    case "section_included": {
      const wanted = String(value);
      const found = decision.sectionPlan.some((item) => item.type === wanted || item.variant === wanted);
      return found ? { status: "met", evidence: `${wanted} is included.` } : { status: "unmet", evidence: `${wanted} is missing.` };
    }
    case "section_excluded": {
      const wanted = String(value);
      const found = decision.sectionPlan.some((item) => item.type === wanted || item.variant === wanted);
      return !found ? { status: "met", evidence: `${wanted} is left out.` } : { status: "unmet", evidence: `${wanted} is still present.` };
    }
    case "section_order": {
      const order = (Array.isArray(value) ? value : [String(value)]).map(String);
      const indexes = order.map((id) => decision.sectionPlan.findIndex((item) => item.type === id || item.variant === id));
      const valid = indexes.every((index) => index >= 0);
      const ordered = valid && indexes.every((index, position) => position === 0 || indexes[position - 1]! < index);
      return ordered ? { status: "met", evidence: "Sections follow the requested order." } : { status: "unmet", evidence: "Sections are not in the requested order." };
    }
    case "page_included":
      return decision.pages.includes(String(value)) ? { status: "met", evidence: `${String(value)} page included.` } : { status: "unmet", evidence: `${String(value)} page missing.` };
    case "page_excluded":
      return !decision.pages.includes(String(value)) ? { status: "met", evidence: `${String(value)} page left out.` } : { status: "unmet", evidence: `${String(value)} page is still present.` };
    case "page_count":
      return decision.pages.length === Number(value) ? { status: "met", evidence: `${decision.pages.length} pages.` } : { status: "unmet", evidence: `${decision.pages.length} pages; ${Number(value)} requested.` };
    case "copy_mentions": {
      const text = textOf(content);
      return text.includes(normalised(String(value))) ? { status: "met", evidence: `The copy mentions ${String(value)}.` } : { status: "unmet", evidence: `The copy does not mention ${String(value)}.` };
    }
    case "copy_avoids": {
      const text = textOf(content);
      return !text.includes(normalised(String(value))) ? { status: "met", evidence: `${String(value)} is absent.` } : { status: "unmet", evidence: `${String(value)} is still used.` };
    }
    case "tone": {
      const text = textOf(content);
      if (!text) return { status: "unmet", evidence: "There is no copy to check yet." };
      const markers = TONE_MARKERS[String(value)] ?? [];
      const matched = markers.filter((marker) => text.includes(marker));
      return matched.length >= Math.min(2, markers.length) ? { status: "met", evidence: `The copy reads ${String(value)}.` } : { status: "unmet", evidence: `The copy does not clearly read ${String(value)}.` };
    }
    case "contrast_ok": {
      const colours = theme.colors;
      if (!colours) return { status: "unmet", evidence: "No colours are set." };
      const tokens = deriveTokens(colours);
      const ok =
        contrastRatio(tokens["--s-text"]!, tokens["--s-bg"]!) >= 4.5 &&
        contrastRatio(tokens["--s-on-primary"]!, tokens["--s-primary"]!) >= 4.5 &&
        contrastRatio(tokens["--s-on-accent"]!, tokens["--s-accent"]!) >= 4.5;
      return ok ? { status: "met", evidence: "All required contrasts pass." } : { status: "unmet", evidence: "Some text does not meet the contrast target." };
    }
    case "language":
      return specLanguageMet(decision, requirement) ? { status: "met", evidence: `Language ${String(value)} applied.` } : { status: "unmet", evidence: `Language ${String(value)} was not applied.` };
    default:
      return { status: "unmet", evidence: "This requirement is not supported." };
  }
}

function specLanguageMet(_decision: DesignDecision, requirement: Requirement): boolean {
  return typeof requirement.value === "string" && requirement.value.length >= 2;
}

export function verifyDesign(spec: DesignSpec, decision: DesignDecision, content?: DesignContent): VerifyResult {
  const items: DesignReportItem[] = spec.requirements.map((requirement) => {
    const checked = checkRequirement(requirement, decision, content);
    return {
      requirementId: requirement.id,
      status: checked.status,
      planned: requirement.value,
      evidence: checked.evidence,
    };
  });
  const colours = decision.theme.colors;
  const contrastFails =
    colours &&
    (() => {
      const tokens = deriveTokens(colours);
      return (
        contrastRatio(tokens["--s-text"]!, tokens["--s-bg"]!) < 4.5 ||
        contrastRatio(tokens["--s-on-primary"]!, tokens["--s-primary"]!) < 4.5 ||
        contrastRatio(tokens["--s-on-accent"]!, tokens["--s-accent"]!) < 4.5
      );
    })();
  if (contrastFails && !spec.requirements.some((requirement) => requirement.kind === "contrast_ok")) {
    items.push({
      requirementId: "contrast_ok:palette",
      status: "unmet",
      planned: "All text meets the contrast target",
      evidence: "Some text does not meet the contrast target.",
    });
  }
  const unmet = items.filter((item) => item.status === "unmet");
  const total =
    spec.requirements.reduce((sum, requirement) => sum + WEIGHTS[requirement.strength], 0) +
    (contrastFails && !spec.requirements.some((requirement) => requirement.kind === "contrast_ok") ? WEIGHTS.must : 0);
  const met = spec.requirements.reduce((sum, requirement) => {
    const item = items.find((entry) => entry.requirementId === requirement.id);
    return sum + (item?.status === "met" ? WEIGHTS[requirement.strength] : 0);
  }, 0);
  return {
    items,
    accuracy: total === 0 ? 1 : met / total,
    unmet,
    unsupported: spec.unsupported.map((item) => ({ text: item.text, nearest: item.nearest })),
    weights: WEIGHTS,
  };
}
