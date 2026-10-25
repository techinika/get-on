"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blockWithIdSchema, migrateContent } from "@get-on/blocks";
import {
  generateSectionsWithAi,
  writeWithAi,
  type AiSectionActionResult,
  type AiTextActionResult,
} from "@/lib/ai/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import {
  applyTemplateSlots,
  collectTemplateSlots,
  type PageRow,
} from "@/lib/ai/template-slots";

const writeInput = z.object({
  projectId: z.string().uuid(),
  brief: z.string().min(1).max(20000),
});

const appendInput = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  blocks: z.array(blockWithIdSchema).min(1).max(6),
});

type AppendResult = { ok: true } | { ok: false; code: string };

export async function writeSectionWithAi(input: {
  projectId: string;
  brief: string;
}): Promise<AiSectionActionResult> {
  const parsed = writeInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Please describe the section you want first.",
    };
  }
  return generateSectionsWithAi({
    projectId: parsed.data.projectId,
    brief: parsed.data.brief,
  });
}

export async function appendAiSections(input: {
  projectId: string;
  pageId: string;
  blocks: unknown[];
}): Promise<AppendResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, code: "AUTH" };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  const parsed = appendInput.safeParse(input);
  if (!parsed.success) return { ok: false, code: "AI_BAD_RESULT" };

  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id, project_id, blocks")
    .eq("id", parsed.data.pageId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  if (!page) return { ok: false, code: "FORBIDDEN" };

  const content = migrateContent(page.blocks);
  const blocks = [...content.blocks, ...parsed.data.blocks];
  const { error } = await supabase
    .from("pages")
    .update({ blocks })
    .eq("id", parsed.data.pageId)
    .eq("project_id", parsed.data.projectId);
  if (error) return { ok: false, code: "UNKNOWN" };

  revalidatePath(
    `/dashboard/projects/${parsed.data.projectId}/pages/${parsed.data.pageId}`,
  );
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}/pages`);
  return { ok: true };
}

const fieldInput = z.object({
  projectId: z.string().uuid(),
  text: z.string().max(20000),
  instruction: z.string().max(300),
  mode: z.enum(["write", "improve"]),
});

const saveTextInput = z.object({
  projectId: z.string().uuid(),
  pageId: z.string().uuid(),
  updates: z
    .array(
      z.object({
        id: z.string().min(1).max(160),
        text: z.string().max(1200),
      }),
    )
    .min(1)
    .max(80),
});

export async function writeFieldWithAi(input: {
  projectId: string;
  text: string;
  instruction: string;
  mode: "write" | "improve";
}): Promise<AiTextActionResult> {
  const parsed = fieldInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That field is too long for AI. Try a shorter piece.",
    };
  }
  const instruction = parsed.data.instruction.trim();
  const text = parsed.data.text.trim();
  return writeWithAi({
    projectId: parsed.data.projectId,
    taskId: parsed.data.mode === "write" ? "text.write" : "text.improve",
    text: [instruction, text].filter(Boolean).join("\n\n"),
    existingText: text,
  });
}

export async function savePageText(input: {
  projectId: string;
  pageId: string;
  updates: Array<{ id: string; text: string }>;
}): Promise<{ ok: true; changed: number } | { ok: false; message: string }> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: "Please sign in again." };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, message: "Only editors, admins and the owner can change this page." };
  }

  const parsed = saveTextInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Those changes could not be saved." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("id, project_id, blocks")
    .eq("id", parsed.data.pageId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();
  if (!data) return { ok: false, message: "We could not find that page." };

  const pages: PageRow[] = [{ id: data.id, blocks: data.blocks }];
  const plan = collectTemplateSlots(pages, { includeEmpty: true });
  const applied = applyTemplateSlots(
    pages,
    plan,
    new Map(parsed.data.updates.map((update) => [update.id, update.text])),
  );
  if (applied.changed === 0) {
    return { ok: false, message: "Nothing changed." };
  }

  const { error } = await supabase
    .from("pages")
    .update({ blocks: applied.pages[0]!.blocks })
    .eq("id", parsed.data.pageId)
    .eq("project_id", parsed.data.projectId);
  if (error) return { ok: false, message: "Your changes could not be saved. Try again." };

  revalidatePath(
    `/dashboard/projects/${parsed.data.projectId}/pages/${parsed.data.pageId}`,
  );
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}/pages`);
  revalidatePath(`/dashboard/projects/${parsed.data.projectId}`);
  return { ok: true, changed: applied.changed };
}
