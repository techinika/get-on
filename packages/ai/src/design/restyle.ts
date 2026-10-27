import type { Theme, ThemeColors } from "@get-on/blocks";
import { resolveDesign, type DesignBrief, type DesignDecision, type DesignPlan, type SectionPlanItem } from "./resolve";
import { parseDesign } from "./parse";
import type { DesignSpec } from "./spec";

export type CurrentLook = {
  theme: Theme;
  heroLayout: string;
  heroProps: Record<string, unknown>;
  header?: Theme["header"];
  footer?: Theme["footer"];
  sectionPlan: SectionPlanItem[];
  pages: string[];
};

export type RestyleResult = {
  decision: DesignDecision;
  contentChanged: false;
  previewChanged: boolean;
  changes: Array<{ area: string; from: string; to: string }>;
};

function change(area: string, from: unknown, to: unknown): { area: string; from: string; to: string } {
  return { area, from: String(from ?? ""), to: String(to ?? "") };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function restyleDesign(
  briefText: string,
  current: CurrentLook,
  brief: DesignBrief = {},
  plan: DesignPlan = {},
  specOverride?: DesignSpec,
): RestyleResult {
  const spec: DesignSpec = specOverride ?? parseDesign(briefText);
  const resolved = resolveDesign(spec, brief, plan);
  const theme = clone(current.theme);
  const paletteAsked = Boolean(
    spec.palette.primary ||
      spec.palette.accent ||
      spec.palette.background ||
      spec.palette.text ||
      spec.palette.soft ||
      spec.palette.mode !== "light" ||
      spec.palette.mood ||
      spec.palette.userHex.length,
  );
  if (paletteAsked) {
    theme.colors = resolved.theme.colors;
    theme.colorMode = resolved.theme.colorMode;
  }
  if (spec.fonts.heading || spec.fonts.body || spec.fonts.feel) {
    theme.fonts = resolved.theme.fonts;
  }
  if (spec.layout.density) theme.density = resolved.theme.density;
  if (spec.layout.corners) theme.corners = resolved.theme.corners;
  if (spec.layout.buttonShape || spec.layout.buttonStyle) theme.buttons = resolved.theme.buttons;
  if (spec.layout.rhythm || spec.layout.imageStyle || Object.keys(spec.design).length) {
    theme.design = { ...(theme.design ?? {}), ...(resolved.theme.design ?? {}) };
  }
  const header = spec.layout.header ? resolved.header : current.header;
  const footer = spec.layout.footer ? resolved.footer : current.footer;
  if (header) theme.header = header;
  if (footer) theme.footer = footer;

  const decision: DesignDecision = {
    ...resolved,
    theme,
    header: header ?? resolved.header,
    footer: footer ?? resolved.footer,
    sectionPlan: current.sectionPlan,
    pages: current.pages,
    requestedPageCount: current.pages.length,
    heroLayout: spec.layout.hero ?? current.heroLayout,
    heroProps: { ...current.heroProps, ...(spec.layout.hero ? { layout: spec.layout.hero } : {}), ...(spec.layout.align ? { align: spec.layout.align } : {}) },
    report: resolved.report,
  };
  const changes: Array<{ area: string; from: string; to: string }> = [];
  const before: Partial<ThemeColors> = current.theme.colors ?? {};
  const after: Partial<ThemeColors> = decision.theme.colors ?? {};
  for (const role of ["primary", "accent", "background", "text", "soft"] as const) {
    if (before[role] !== after[role]) changes.push(change(`colour ${role}`, before[role], after[role]));
  }
  if (current.heroLayout !== decision.heroLayout) changes.push(change("hero", current.heroLayout, decision.heroLayout));
  if (header && (current.header?.style ?? "classic") !== (header.style ?? "classic")) {
    changes.push(change("header", current.header?.style ?? "classic", header.style ?? "classic"));
  }
  if (footer && (current.footer?.layout ?? "simple") !== (footer.layout ?? "simple")) {
    changes.push(change("footer", current.footer?.layout ?? "simple", footer.layout ?? "simple"));
  }
  const beforeFonts = `${current.theme.fonts?.heading.id ?? ""}/${current.theme.fonts?.body.id ?? ""}`;
  const afterFonts = `${decision.theme.fonts?.heading.id ?? ""}/${decision.theme.fonts?.body.id ?? ""}`;
  if (beforeFonts !== afterFonts) changes.push(change("fonts", beforeFonts, afterFonts));
  return {
    decision,
    contentChanged: false,
    previewChanged: changes.length > 0,
    changes,
  };
}
