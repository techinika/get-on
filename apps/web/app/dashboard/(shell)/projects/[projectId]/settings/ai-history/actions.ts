"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import {
  applyTemplateSlots,
  collectTemplateSlots,
  type PageRow,
} from "@/lib/ai/template-slots";
import {
  isUndoableTask,
  templateFillSlots,
  wasUndone,
} from "@/lib/ai/history";

export type UndoAiResult =
  | { ok: true; changed: number }
  | { ok: false; message: string };

type RequestRow = {
  id: string;
  team_id: string;
  project_id: string | null;
  task: string;
  status: string;
  steps: unknown;
};

export async function undoAiRequest(
  requestId: string,
  projectId: string,
): Promise<UndoAiResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: "Please sign in again." };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, message: "Only editors, admins and the owner can undo AI changes." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_requests")
    .select("id, team_id, project_id, task, status, steps")
    .eq("id", requestId)
    .eq("team_id", current.team.teamId)
    .eq("project_id", projectId)
    .maybeSingle();
  const request = data as RequestRow | null;
  if (!request) return { ok: false, message: "We could not find that AI change." };
  if (!isUndoableTask(request.task)) {
    return { ok: false, message: "This AI change cannot be undone from here." };
  }
  if (!["succeeded", "partial"].includes(request.status)) {
    return { ok: false, message: "This AI change did not finish, so there is nothing to undo." };
  }
  if (wasUndone(request.steps)) {
    return { ok: false, message: "This AI change has already been undone." };
  }

  const admin = createAdminClient();
  const { data: payload } = await admin
    .from("ai_payloads")
    .select("input")
    .eq("request_id", requestId)
    .maybeSingle();
  const input = payload?.input;
  const before =
    input && typeof input === "object"
      ? templateFillSlots((input as { existingText?: unknown }).existingText)
      : [];
  if (before.length === 0) {
    return { ok: false, message: "The details for this AI change are no longer available." };
  }

  const { data: pagesData, error: pagesError } = await supabase
    .from("pages")
    .select("id, blocks")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (pagesError) {
    return { ok: false, message: "We could not read your pages. Try again." };
  }
  const pages = (pagesData ?? []) as PageRow[];
  const plan = collectTemplateSlots(pages);
  const applied = applyTemplateSlots(
    pages,
    plan,
    new Map(before.map((slot) => [slot.id, slot.text])),
  );
  if (applied.changed === 0) {
    return { ok: false, message: "Your pages have changed since then, so this cannot be undone safely." };
  }

  for (const page of applied.pages) {
    if (page.changed === 0) continue;
    const { error } = await supabase
      .from("pages")
      .update({ blocks: page.blocks })
      .eq("id", page.id)
      .eq("project_id", projectId);
    if (error) {
      return { ok: false, message: "Some text could not be put back. Try again." };
    }
  }

  const steps = Array.isArray(request.steps) ? request.steps : [];
  await admin
    .from("ai_requests")
    .update({
      steps: [...steps, { type: "undo", at: new Date().toISOString() }],
    })
    .eq("id", requestId);

  revalidatePath(`/dashboard/projects/${projectId}/settings/ai-history`);
  revalidatePath(`/dashboard/projects/${projectId}/ai-history`);
  revalidatePath(`/dashboard/projects/${projectId}/pages`);
  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true, changed: applied.changed };
}
