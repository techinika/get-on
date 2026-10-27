"use server";

import { z } from "zod";
import {
  materializeTemplate,
  requireSystemTemplate,
  type MaterializedPage,
} from "@get-on/templates";
import { readRendererCss, renderHtml } from "@get-on/publisher";
import { getCurrentTeam, planLimits } from "@/lib/team";
import { parseDesignPrefs } from "@/lib/ai/design-prefs";
import {
  applyWizardDesignToPages,
  buildWizardDesign,
} from "@/lib/ai/wizard-design";

const inputSchema = z.object({
  name: z.string().trim().max(120),
  businessType: z.string().trim().max(80),
  about: z.string().max(300),
  brief: z.string().max(400),
  prefs: z.unknown(),
});

export type DesignLookPreview = {
  id: string;
  name: string;
  description: string;
  key: string;
  previewHtml: string;
  colors: string[];
  hero: string;
  header: string;
  pages: number;
  accuracy: number;
  unsupported: { text: string; nearest?: string }[];
};

export type DesignLooksResult =
  | { ok: true; looks: DesignLookPreview[] }
  | { ok: false; code: "AUTH" | "FORBIDDEN" | "PREVIEW_FAILED"; message: string };

function previewHtml(input: {
  name: string;
  businessType: string;
  theme: Parameters<typeof renderHtml>[0]["settings"]["theme"];
  page: MaterializedPage;
}): string {
  return renderHtml({
    settings: {
      businessName: input.name || "Your business",
      tagline: "",
      theme: input.theme,
      businessType: input.businessType || null,
      plan: "pro",
      showWatermark: false,
    },
    page: {
      id: input.page.id,
      slug: "",
      title: input.page.title,
      description: input.page.seoDescription || null,
      seoTitle: input.page.seoTitle || null,
      seoDescription: input.page.seoDescription || null,
      blocks: input.page.blocks,
    },
    canonical: "https://example.com/",
    css: readRendererCss(),
    nav: [{ label: "Home", href: "/", pageId: input.page.id }],
    images: new Map(),
    logoUrl: null,
    ogImageUrl: null,
    contactEnabled: false,
    pagePath: "/",
  });
}

export async function previewWizardDesignLooks(input: {
  name: string;
  businessType: string;
  about: string;
  brief: string;
  prefs: unknown;
}): Promise<DesignLooksResult> {
  const current = await getCurrentTeam();
  if (!current) {
    return { ok: false, code: "AUTH", message: "Please sign in again." };
  }
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only editors, admins and the owner can use AI here.",
    };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "PREVIEW_FAILED",
      message: "Please check the design details and try again.",
    };
  }

  const prefs = parseDesignPrefs(parsed.data.prefs);
  const plan = planLimits(current.team.planId);
  const design = buildWizardDesign({
    name: parsed.data.name,
    businessType: parsed.data.businessType,
    about: parsed.data.about,
    prefs,
    brief: parsed.data.brief,
    teamId: current.team.teamId,
    planId: current.team.planId,
    maxPages: plan.maxPagesPerSite,
  });

  try {
    const looks = design.looks.map((look) => {
      const pkg = requireSystemTemplate(look.decision.archetype);
      const materialized = materializeTemplate(pkg, {
        profile: {
          businessName: parsed.data.name,
          description: parsed.data.about,
          businessType: parsed.data.businessType,
        },
        maxPages: 1,
        compositionId: look.decision.compositionId,
      });
      const pages = applyWizardDesignToPages(materialized.pages, look.decision, {
        includeContactForm: false,
      });
      const home = pages.find((page) => page.isHome) ?? pages[0];
      if (!home) throw new Error("NO_PREVIEW_PAGE");
      return {
        id: look.id,
        name: look.name,
        description: look.description,
        key: look.key,
        previewHtml: previewHtml({
          name: parsed.data.name,
          businessType: parsed.data.businessType,
          theme: look.decision.theme,
          page: home,
        }),
        colors: [
          look.decision.theme.colors?.primary,
          look.decision.theme.colors?.accent,
          look.decision.theme.colors?.background,
          look.decision.theme.colors?.text,
          look.decision.theme.colors?.soft,
        ].filter((color): color is string => typeof color === "string"),
        hero: look.decision.heroLayout,
        header: look.decision.header.style ?? "classic",
        pages: look.decision.pages.length,
        accuracy: look.decision.report.accuracy,
        unsupported: look.decision.report.unsupported,
      } satisfies DesignLookPreview;
    });

    return { ok: true, looks };
  } catch (error) {
    console.error("[wizard] design preview failed", error);
    return {
      ok: false,
      code: "PREVIEW_FAILED",
      message: "We could not draw those looks. Try again.",
    };
  }
}
