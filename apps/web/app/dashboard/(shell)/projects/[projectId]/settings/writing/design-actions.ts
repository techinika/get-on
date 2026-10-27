"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  migrateContent,
  resolveThemeColors,
  type Theme,
} from "@get-on/blocks";
import {
  parseDesign,
  restyleDesign,
  type CurrentLook,
  type DesignReport,
  type RestyleResult,
  type SectionPlanItem,
} from "@get-on/ai";
import { designInterpretationSchema } from "@/lib/ai/design-schema";
import {
  applyDesignPrefsAsDefaults,
  mergeDesignInterpretation,
  parseDesignPrefs,
} from "@/lib/ai/design-prefs";
import { runTask } from "@/lib/ai/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam, planLimits } from "@/lib/team";

const restyleInput = z.object({
  projectId: z.string().uuid(),
  instruction: z.string().trim().min(3).max(300),
});

const applyInput = z.object({
  previewId: z.string().uuid(),
});

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RestyleChange = { area: string; from: string; to: string };

export type RestylePreview = {
  id: string;
  changes: RestyleChange[];
  report: DesignReport;
  archetype: string;
  credits: number;
  unsupported: { text: string; nearest?: string }[];
};

export type RestyleResultAction =
  | { ok: true; preview: RestylePreview }
  | { ok: false; code: string; message: string };

export type ApplyRestyleResult =
  | { ok: true; changes: number }
  | { ok: false; code: string; message: string };

function canEdit(role: string) {
  return role === "owner" || role === "admin" || role === "editor";
}

function themeFrom(value: unknown): Theme {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Theme)
    : { corners: "soft" };
}

function sectionPlan(blocks: unknown[]): SectionPlanItem[] {
  return blocks.map((block) => {
    const item = block && typeof block === "object" ? (block as Record<string, unknown>) : {};
    return {
      type: typeof item.type === "string" ? item.type : "section",
      variant: typeof item.variant === "string" ? item.variant : undefined,
      source: "template" as const,
    };
  });
}

function heroFrom(blocks: unknown[]): {
  layout: string;
  props: Record<string, unknown>;
} {
  const hero = blocks.find(
    (block) => block && typeof block === "object" && (block as Record<string, unknown>).type === "hero",
  );
  const props =
    hero && typeof hero === "object" && (hero as Record<string, unknown>).props &&
    typeof (hero as Record<string, unknown>).props === "object"
      ? ((hero as Record<string, unknown>).props as Record<string, unknown>)
      : {};
  return {
    layout: typeof props.layout === "string" ? props.layout : "split",
    props,
  };
}

async function loadProject(
  supabase: Supabase,
  projectId: string,
  teamId: string,
) {
  const { data } = await supabase
    .from("projects")
    .select("id, name, team_id")
    .eq("id", projectId)
    .eq("team_id", teamId)
    .maybeSingle();
  return data;
}

async function loadLook(
  supabase: Supabase,
  projectId: string,
): Promise<{ current: CurrentLook; settings: Record<string, unknown>; businessType?: string } | null> {
  const [{ data: settings }, { data: pages }] = await Promise.all([
    supabase
      .from("project_settings")
      .select("theme, settings, design_prefs")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("pages")
      .select("id, title, path, blocks")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);
  if (!settings) return null;

  const pageRows = pages ?? [];
  const home =
    pageRows.find((page) => page.path === "/") ?? pageRows[0] ?? null;
  const content = migrateContent(home?.blocks);
  const hero = heroFrom(content.blocks);
  const theme = themeFrom(settings.theme);
  const settingsJson =
    settings.settings && typeof settings.settings === "object"
      ? (settings.settings as Record<string, unknown>)
      : {};

  return {
    current: {
      theme,
      heroLayout: hero.layout,
      heroProps: hero.props,
      header: theme.header,
      footer: theme.footer,
      sectionPlan: sectionPlan(content.blocks),
      pages: pageRows.map((page) => page.title || page.path || "Page"),
    },
    settings: settingsJson,
    businessType:
      typeof settingsJson.businessType === "string"
        ? settingsJson.businessType
        : undefined,
  };
}

async function recordUnsupported(
  teamId: string,
  projectId: string,
  items: { text: string; nearest?: string }[],
) {
  if (items.length === 0) return;
  try {
    const admin = createAdminClient();
    for (const item of items.slice(0, 20)) {
      const text = item.text.trim().toLowerCase().slice(0, 300);
      if (!text) continue;
      const { data: existing } = await admin
        .from("ai_unsupported_requests")
        .select("id, count")
        .eq("team_id", teamId)
        .eq("text", text)
        .maybeSingle();
      if (existing) {
        await admin
          .from("ai_unsupported_requests")
          .update({ count: Number(existing.count ?? 1) + 1 })
          .eq("id", existing.id);
      } else {
        await admin.from("ai_unsupported_requests").insert({
          team_id: teamId,
          project_id: projectId,
          text,
          nearest: item.nearest?.slice(0, 300) ?? null,
        });
      }
    }
  } catch {
    // Reporting must never break a preview.
  }
}

async function savePreview(
  teamId: string,
  projectId: string,
  requestId: string | undefined,
  instruction: string,
  result: RestyleResult,
  spec: ReturnType<typeof parseDesign>,
): Promise<string> {
  const admin = createAdminClient();
  const theme = result.decision.theme;
  const colors = resolveThemeColors(theme);
  const { data, error } = await admin
    .from("ai_design_history")
    .insert({
      team_id: teamId,
      project_id: projectId,
      request_id: requestId ?? null,
      instruction,
      archetype: result.decision.archetype,
      hero: result.decision.heroLayout,
      palette_family: colors.primary,
      font_pair: `${theme.fonts?.heading.id ?? ""}/${theme.fonts?.body.id ?? ""}`,
      header: result.decision.header.style ?? "classic",
      rhythm: theme.design?.rhythm ?? "even",
      theme,
      footer: result.decision.footer,
      hero_layout: result.decision.heroLayout,
      spec,
      report: result.decision.report,
      changes: result.changes,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("preview_not_saved");

  await admin.from("ai_design_reports").insert({
    request_id: requestId ?? null,
    team_id: teamId,
    project_id: projectId,
    spec,
    result: {
      archetype: result.decision.archetype,
      theme,
      heroLayout: result.decision.heroLayout,
      header: result.decision.header,
      footer: result.decision.footer,
      changes: result.changes,
    },
    accuracy: result.decision.report.accuracy,
    weights: result.decision.report.weights,
    unmet: result.decision.report.unmet,
    unsupported: result.decision.report.unsupported,
    archetype: result.decision.archetype,
    variants: {},
    rounds: 0,
  });

  await recordUnsupported(teamId, projectId, result.decision.report.unsupported);

  return data.id as string;
}

export async function previewDesignRestyle(input: {
  projectId: string;
  instruction: string;
}): Promise<RestyleResultAction> {
  const parsed = restyleInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Describe the change in a few words first.",
    };
  }

  const current = await getCurrentTeam();
  if (!current) return { ok: false, code: "AUTH", message: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only editors, admins and the owner can change the look.",
    };
  }

  const supabase = await createClient();
  const project = await loadProject(supabase, parsed.data.projectId, current.team.teamId);
  if (!project) {
    return { ok: false, code: "NOT_FOUND", message: "We could not find that website." };
  }
  const look = await loadLook(supabase, parsed.data.projectId);
  if (!look) {
    return { ok: false, code: "NOT_FOUND", message: "We could not find that website." };
  }

  const task = await runTask("design.restyle", {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: parsed.data.projectId,
    userInput: parsed.data.instruction,
  });
  if (!task.ok) {
    return { ok: false, code: task.code, message: task.message };
  }

  const interpretation = designInterpretationSchema.safeParse(task.data);
  if (!interpretation.success) {
    return {
      ok: false,
      code: "AI_BAD_RESULT",
      message: "We could not understand that change. Please try again.",
    };
  }

  const plan = planLimits(current.team.planId);
  const { data: prefsRow } = await supabase
    .from("project_settings")
    .select("design_prefs")
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  const spec = applyDesignPrefsAsDefaults(
    mergeDesignInterpretation(
      parseDesign(parsed.data.instruction),
      interpretation.data,
    ),
    parseDesignPrefs(prefsRow?.design_prefs),
  );
  const result = restyleDesign(
    parsed.data.instruction,
    look.current,
    {
      businessType: look.businessType,
      businessName: project.name,
      teamId: current.team.teamId,
      requestId: task.requestId,
    },
    {
      planId: current.team.planId,
      maxPages: plan.maxPagesPerSite ?? undefined,
    },
    spec,
  );

  let previewId: string;
  try {
    previewId = await savePreview(
      current.team.teamId,
      parsed.data.projectId,
      task.requestId,
      parsed.data.instruction,
      result,
      spec,
    );
  } catch {
    return {
      ok: false,
      code: "UNKNOWN",
      message: "We could not save the preview. Please try again.",
    };
  }

  return {
    ok: true,
    preview: {
      id: previewId,
      changes: result.changes,
      report: result.decision.report,
      archetype: result.decision.archetype,
      credits: task.credits,
      unsupported: result.decision.report.unsupported,
    },
  };
}

export async function applyDesignRestyle(input: {
  previewId: string;
}): Promise<ApplyRestyleResult> {
  const parsed = applyInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "NOT_FOUND", message: "That preview is no longer available." };
  }

  const current = await getCurrentTeam();
  if (!current) return { ok: false, code: "AUTH", message: "Please sign in again." };
  if (!canEdit(current.team.role)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only editors, admins and the owner can change the look.",
    };
  }

  const admin = createAdminClient();
  const { data: preview } = await admin
    .from("ai_design_history")
    .select("id, team_id, project_id, theme, hero_layout, changes, applied_at")
    .eq("id", parsed.data.previewId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!preview || !preview.project_id) {
    return { ok: false, code: "NOT_FOUND", message: "That preview is no longer available." };
  }
  if (preview.applied_at) {
    return { ok: false, code: "ALREADY_APPLIED", message: "That look is already applied." };
  }

  const supabase = await createClient();
  const project = await loadProject(
    supabase,
    preview.project_id,
    current.team.teamId,
  );
  if (!project) {
    return { ok: false, code: "NOT_FOUND", message: "We could not find that website." };
  }

  const theme = themeFrom(preview.theme);
  const { error } = await supabase.from("project_settings").upsert(
    { project_id: preview.project_id, theme },
    { onConflict: "project_id" },
  );
  if (error) {
    return { ok: false, code: "UNKNOWN", message: "We could not apply that look. Please try again." };
  }

  if (typeof preview.hero_layout === "string" && preview.hero_layout) {
    const { data: home } = await supabase
      .from("pages")
      .select("id, blocks")
      .eq("project_id", preview.project_id)
      .eq("path", "/")
      .maybeSingle();
    if (home) {
      const content = migrateContent(home.blocks);
      let changed = false;
      const blocks = content.blocks.map((block) => {
        if (!block || typeof block !== "object") return block;
        if ((block as Record<string, unknown>).type !== "hero") return block;
        changed = true;
        const props =
          (block as Record<string, unknown>).props &&
          typeof (block as Record<string, unknown>).props === "object"
            ? ((block as Record<string, unknown>).props as Record<string, unknown>)
            : {};
        return {
          ...(block as Record<string, unknown>),
          props: { ...props, layout: preview.hero_layout },
        };
      });
      if (changed) {
        await supabase
          .from("pages")
          .update({ blocks })
          .eq("id", home.id)
          .eq("project_id", preview.project_id);
      }
    }
  }

  await admin
    .from("ai_design_history")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", preview.id);

  revalidatePath(`/dashboard/projects/${preview.project_id}`);
  revalidatePath(`/dashboard/projects/${preview.project_id}/settings`, "layout");
  revalidatePath(`/dashboard/projects/${preview.project_id}/settings/writing`);
  revalidatePath(`/dashboard/projects/${preview.project_id}/settings/ai-history`);

  return {
    ok: true,
    changes: Array.isArray(preview.changes) ? preview.changes.length : 0,
  };
}
