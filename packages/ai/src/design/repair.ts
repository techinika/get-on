import { luminance } from "@get-on/blocks";
import { FEEL_FONTS } from "./fonts";
import type { DesignDecision, DesignReportItem } from "./resolve";
import { verifyDesign, type DesignContent, type VerifyResult } from "./verify";
import type { DesignSpec, Requirement } from "./spec";

export type RepairOptions = {
  maxPages?: number;
  rewrite?: (failing: DesignReportItem[], content: DesignContent) => DesignContent | Promise<DesignContent>;
};

export type RepairResult = {
  decision: DesignDecision;
  content: DesignContent;
  report: VerifyResult;
  rounds: number;
  repaired: string[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyToken(decision: DesignDecision, requirement: Requirement): boolean {
  const value = String(requirement.value);
  switch (requirement.kind) {
    case "color_exact": {
      const target = requirement.target as "primary" | "accent" | "background" | "text" | "soft";
      if (!decision.theme.colors) return false;
      decision.theme.colors[target] = value.toLowerCase();
      return true;
    }
    case "mode": {
      const dark = value === "dark";
      decision.theme.colorMode = dark ? "dark" : "light";
      if (dark && decision.theme.colors && luminance(decision.theme.colors.background) >= 0.2) {
        decision.theme.colors.background = "#0B0F14";
        decision.theme.colors.text = "#E6EDF3";
        decision.theme.colors.soft = "#15191E";
      }
      if (!dark && decision.theme.colors && luminance(decision.theme.colors.background) < 0.2) {
        decision.theme.colors.background = "#FFFFFF";
        decision.theme.colors.text = "#111827";
        decision.theme.colors.soft = "#F2F4F7";
      }
      return true;
    }
    case "font_exact": {
      if (!decision.theme.fonts) return false;
      const target = requirement.target === "body" ? "body" : "heading";
      decision.theme.fonts[target] = { ...decision.theme.fonts[target], id: value };
      return true;
    }
    case "font_feel": {
      const pair = FEEL_FONTS[value as keyof typeof FEEL_FONTS];
      if (!pair || !decision.theme.fonts) return false;
      decision.theme.fonts.heading = { ...decision.theme.fonts.heading, id: pair.heading };
      decision.theme.fonts.body = { ...decision.theme.fonts.body, id: pair.body };
      return true;
    }
    case "hero_layout":
      decision.heroLayout = value;
      decision.heroProps = { ...decision.heroProps, layout: value };
      return true;
    case "header_style":
      decision.header = { ...decision.header, style: value as NonNullable<DesignDecision["header"]["style"]> };
      decision.theme.header = decision.header;
      return true;
    case "footer_layout":
      decision.footer = { ...decision.footer, layout: value as NonNullable<DesignDecision["footer"]["layout"]> };
      decision.theme.footer = decision.footer;
      return true;
    case "density":
      decision.theme.density = value as DesignDecision["theme"]["density"];
      return true;
    case "rhythm":
      decision.theme.design = { ...(decision.theme.design ?? {}), rhythm: value as never };
      return true;
    case "corners":
      decision.theme.corners = value as DesignDecision["theme"]["corners"];
      return true;
    case "button_shape":
      if (!decision.theme.buttons) return false;
      decision.theme.buttons.shape = value as never;
      return true;
    case "button_style":
      if (!decision.theme.buttons) return false;
      decision.theme.buttons.style = value as never;
      return true;
    case "image_style":
      decision.theme.design = { ...(decision.theme.design ?? {}), imageStyle: value as never };
      return true;
    case "alignment":
      decision.heroProps = { ...decision.heroProps, align: value };
      return true;
    case "section_included": {
      if (!decision.sectionPlan.some((item) => item.type === value)) {
        decision.sectionPlan = [...decision.sectionPlan, { type: value, source: "added" }];
      }
      return true;
    }
    case "section_excluded":
      decision.sectionPlan = decision.sectionPlan.filter((item) => item.type !== value && item.variant !== value);
      return true;
    case "section_order": {
      const order = Array.isArray(requirement.value) ? requirement.value.map(String) : [value];
      decision.sectionPlan = [...decision.sectionPlan].sort((a, b) => {
        const ai = order.indexOf(a.type);
        const bi = order.indexOf(b.type);
        if (ai < 0 && bi < 0) return 0;
        if (ai < 0) return 1;
        if (bi < 0) return -1;
        return ai - bi;
      });
      return true;
    }
    case "page_included":
      if (!decision.pages.includes(value)) decision.pages = [...decision.pages, value];
      return true;
    case "page_excluded":
      decision.pages = decision.pages.filter((page) => page !== value);
      return true;
    case "page_count": {
      const wanted = Number(requirement.value);
      if (!Number.isFinite(wanted) || wanted < 1) return false;
      if (decision.pages.length > wanted) decision.pages = decision.pages.slice(0, wanted);
      while (decision.pages.length < wanted) decision.pages.push(`page-${decision.pages.length + 1}`);
      return true;
    }
    default:
      return false;
  }
}

const TOKEN_KINDS = new Set([
  "color_exact",
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
]);

export async function repairDesign(
  spec: DesignSpec,
  initial: DesignDecision,
  initialContent: DesignContent = {},
  options: RepairOptions = {},
): Promise<RepairResult> {
  let decision = clone(initial);
  let content = clone(initialContent);
  let report = verifyDesign(spec, decision, content);
  let best = { decision: clone(decision), content: clone(content), report };
  let rounds = 0;
  const repaired: string[] = [];

  for (let round = 0; round < 2 && report.accuracy < 0.9; round += 1) {
    rounds = round + 1;
    const failing = report.unmet.filter((item) => item.status === "unmet");
    const byId = new Map(spec.requirements.map((requirement) => [requirement.id, requirement]));

    for (const item of failing) {
      const requirement = byId.get(item.requirementId);
      if (!requirement) continue;
      if (TOKEN_KINDS.has(requirement.kind)) {
        const maxPages = options.maxPages;
        if (requirement.kind === "page_count" && maxPages && Number(requirement.value) > maxPages) continue;
        if (applyToken(decision, requirement)) repaired.push(requirement.id);
      }
    }

    const copyFailing = failing.filter((item) => {
      const requirement = byId.get(item.requirementId);
      return requirement && ["copy_mentions", "copy_avoids", "tone"].includes(requirement.kind);
    });
    if (copyFailing.length && options.rewrite) {
      content = await options.rewrite(copyFailing, content);
      for (const item of copyFailing) repaired.push(item.requirementId);
    }

    report = verifyDesign(spec, decision, content);
    if (report.accuracy > best.report.accuracy) {
      best = { decision: clone(decision), content: clone(content), report };
    }
  }

  return { decision: best.decision, content: best.content, report: best.report, rounds, repaired: [...new Set(repaired)] };
}
