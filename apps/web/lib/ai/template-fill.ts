import type { AiErrorCode, AiTaskId } from "@get-on/ai";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { runTask } from "./pipeline";
import {
  applyTemplateSlots,
  collectTemplateSlots,
  type PageRow,
} from "./template-slots";
import type { TemplateFillDraft } from "./template-schema";

export type TemplateFillActionResult =
  | { ok: true; requestId: string; credits: number; changed: number }
  | { ok: false; code: AiErrorCode | "AUTH" | "FORBIDDEN"; message: string };

export async function fillTemplateTextWithAi(input: {
  projectId: string;
  notes?: string;
  taskId?: Extract<AiTaskId, "template.fill" | "site.generate">;
  compact?: boolean;
  context?: string;
}): Promise<TemplateFillActionResult> {
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

  const notes = (input.notes ?? "").trim();
  if (notes.length > 2000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That is too long. Keep your notes under 2,000 characters.",
    };
  }
  const context = (input.context ?? "").trim();
  if (context.length > 4000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That design description is too long for AI to use at once.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pages")
    .select("id, blocks")
    .eq("project_id", input.projectId)
    .order("position", { ascending: true });
  if (error) {
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We could not read your pages. Try again.",
    };
  }

  const pages = (data ?? []) as PageRow[];
  if (pages.length === 0) {
    return {
      ok: false,
      code: "AI_BAD_RESULT",
      message: "Add a page before asking AI to write.",
    };
  }

  const plan = collectTemplateSlots(pages);
  if (plan.slots.length === 0) {
    return {
      ok: false,
      code: "AI_BAD_RESULT",
      message: "We could not find any text for AI to rewrite.",
    };
  }

  const slots = input.compact
    ? plan.slots.map((slot) => ({ id: slot.id, text: slot.text.slice(0, 80) }))
    : plan.slots;
  const existingText = JSON.stringify({ slots });
  if (existingText.length > 20000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "This template has too much text for AI to rewrite at once.",
    };
  }

  const result = await runTask(input.taskId ?? "template.fill", {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId,
    userInput: [
      context,
      notes ||
        "Rewrite the sample template text so it fits this business. Use the business facts and writing style.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    existingText,
  });
  if (!result.ok) return result;

  const draft = result.data as TemplateFillDraft;
  const replacements = new Map(draft.slots.map((slot) => [slot.id, slot.text]));
  const applied = applyTemplateSlots(pages, plan, replacements);

  for (const page of applied.pages) {
    if (page.changed === 0) continue;
    const { error: updateError } = await supabase
      .from("pages")
      .update({ blocks: page.blocks })
      .eq("id", page.id)
      .eq("project_id", input.projectId);
    if (updateError) {
      return {
        ok: false,
        code: "AI_PROVIDER_ERROR",
        message:
          "Your design is ready, but some AI text could not be saved. Try again from the page editor.",
      };
    }
  }

  return {
    ok: true,
    requestId: result.requestId,
    credits: result.credits,
    changed: applied.changed,
  };
}
