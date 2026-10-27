import {
  designLooks,
  parseDesign,
  type DesignBrief,
  type DesignDecision,
  type DesignLook,
  type DesignPlan,
  type DesignSpec,
} from "@get-on/ai";
import type { Block, MaterializedPage } from "@get-on/templates";
import type { PlanId } from "@/lib/plans";
import {
  applyDesignPrefsAsDefaults,
  designPrefsToText,
  type DesignPrefs,
} from "./design-prefs";

export type WizardDesignInput = {
  name: string;
  businessType: string;
  about: string;
  prefs: DesignPrefs;
  brief: string;
  teamId: string;
  planId: PlanId;
  maxPages: number | null;
};

export type WizardDesign = {
  spec: DesignSpec;
  brief: DesignBrief;
  plan: DesignPlan;
  looks: DesignLook[];
};

export function buildWizardDesign(input: WizardDesignInput): WizardDesign {
  const raw = [
    designPrefsToText(input.prefs),
    input.brief.trim(),
    input.about.trim() ? `Business: ${input.about.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 600);
  const spec = applyDesignPrefsAsDefaults(parseDesign(raw), input.prefs);
  const brief: DesignBrief = {
    businessName: input.name,
    businessType: input.businessType || undefined,
    teamId: input.teamId,
    requestId: raw,
  };
  const plan: DesignPlan = {
    planId: input.planId,
    maxPages: input.maxPages ?? undefined,
  };
  return {
    spec,
    brief,
    plan,
    looks: designLooks(spec, brief, plan, { count: 3 }),
  };
}

export function chooseWizardDesign(
  design: WizardDesign,
  lookIndex: number | null,
): { look: DesignLook; decision: DesignDecision } {
  const index =
    typeof lookIndex === "number" && Number.isFinite(lookIndex)
      ? Math.min(design.looks.length - 1, Math.max(0, Math.round(lookIndex)))
      : 0;
  const look = design.looks[index] ?? design.looks[0]!;
  return { look, decision: look.decision };
}

function isContactForm(block: Block): boolean {
  return block.type === "contact-form";
}

function cloneBlock(block: Block): Block {
  const copy = JSON.parse(JSON.stringify(block)) as Block;
  copy.id = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 20) ??
    `${String(block.id ?? "block")}-${Math.random().toString(36).slice(2, 8)}`;
  return copy;
}

export function applyWizardDesignToPages(
  pages: MaterializedPage[],
  decision: DesignDecision,
  options: { includeContactForm: boolean; contactBlock?: Block | null },
): MaterializedPage[] {
  const wanted = new Set(decision.pages);
  const includedTypes = new Set(decision.sectionPlan.map((item) => item.type));
  const pool = new Map<string, Block>();
  for (const page of pages) {
    for (const block of page.blocks) {
      if (!pool.has(block.type)) pool.set(block.type, block);
    }
  }
  const withDesign = pages
    .filter((page) => page.isHome || wanted.has(page.key))
    .map((page) => {
      let blocks = page.blocks
        .filter((block) => options.includeContactForm || !isContactForm(block))
        .map((block) => {
          if (block.type !== "hero") return block;
          return {
            ...block,
            props: {
              ...block.props,
              layout: decision.heroLayout,
              ...decision.heroProps,
            },
          } as Block;
        });

      if (page.isHome) {
        blocks = blocks.filter((block) => includedTypes.has(block.type));
        for (const item of decision.sectionPlan) {
          if (item.type === "contact-form" || blocks.some((block) => block.type === item.type)) {
            continue;
          }
          const source = pool.get(item.type);
          if (source) blocks.push(cloneBlock(source));
        }
        if (
          options.includeContactForm &&
          options.contactBlock &&
          !blocks.some(isContactForm)
        ) {
          blocks = [...blocks, options.contactBlock];
        }
      }

      return { ...page, blocks };
    });

  if (withDesign.length === 0) {
    const home = pages.find((page) => page.isHome) ?? pages[0];
    if (home) return [{ ...home, blocks: home.blocks }];
  }
  return withDesign;
}

export function designSummary(decision: DesignDecision): string {
  const colors = decision.theme.colors;
  const fonts = decision.theme.fonts;
  return [
    `Design: ${decision.archetype}.`,
    `Hero: ${decision.heroLayout}.`,
    `Header: ${decision.header.style ?? "classic"}.`,
    colors?.primary ? `Main colour ${colors.primary}.` : "",
    colors?.accent ? `Accent colour ${colors.accent}.` : "",
    fonts?.heading?.id ? `Headings use ${fonts.heading.id}.` : "",
    decision.pages.length ? `Pages: ${decision.pages.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
