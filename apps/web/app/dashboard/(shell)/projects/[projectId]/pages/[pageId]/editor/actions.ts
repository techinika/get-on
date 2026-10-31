"use server";

import { revalidatePath } from "next/cache";
import { blockSchema, smartNodeFromBlock, validateContentV5, type ContentNode, type PageContentV5 } from "@get-on/blocks";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { generateSectionsWithAi, writeWithAi } from "@/lib/ai/actions";

type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; code: "AUTH" | "FORBIDDEN" | "INVALID" | "REVISION_CONFLICT" | "TOO_LARGE" | "UNKNOWN"; message: string };

export async function savePageContent(input: {
  projectId: string;
  pageId: string;
  content: PageContentV5;
  expectedRevision: number;
}): Promise<SaveResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, code: "AUTH", message: "Please sign in again." };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can change this page." };
  }

  const validated = validateContentV5(input.content);
  if (!validated.ok) {
    return {
      ok: false,
      code: "INVALID",
      message: validated.errors[0]?.message ?? "Those changes could not be saved.",
    };
  }
  const content = validated.content;
  const bytes = new TextEncoder().encode(JSON.stringify(content)).length;
  if (bytes > 1024 * 1024) {
    return { ok: false, code: "TOO_LARGE", message: "This page is too big. Remove something and try again." };
  }

  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id, project_id, blocks")
    .eq("id", input.pageId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!page) return { ok: false, code: "FORBIDDEN", message: "We could not find that page." };

  const stored = page.blocks as { schemaVersion?: number } | null;
  if (stored?.schemaVersion !== 5 && content.meta?.migratedFrom) {
    const { data: snapshot } = await supabase
      .from("page_versions")
      .select("id")
      .eq("page_id", input.pageId)
      .eq("label", "before_editor_v3")
      .limit(1)
      .maybeSingle();
    if (!snapshot) {
      await supabase.from("page_versions").insert({
        page_id: input.pageId,
        content: stored,
        reason: "before_editor_v3",
        label: "before_editor_v3",
        block_count: Array.isArray((stored as { blocks?: unknown[] })?.blocks)
          ? (stored as { blocks: unknown[] }).blocks.length
          : 0,
        created_by: current.user.id,
      });
    }
  }

  const { data, error } = await supabase.rpc("save_page_content", {
    p_page_id: input.pageId,
    p_content: content,
    p_expected_revision: input.expectedRevision,
  });

  if (error) {
    if (error.message.includes("REVISION_CONFLICT")) {
      return {
        ok: false,
        code: "REVISION_CONFLICT",
        message: "Someone else changed this page. Reload to see their changes.",
      };
    }
    if (error.message.includes("CONTENT_TOO_LARGE") || error.message.includes("TOO_MANY")) {
      return { ok: false, code: "TOO_LARGE", message: "This page is too big. Remove something and try again." };
    }
    return { ok: false, code: "UNKNOWN", message: "Your changes could not be saved. Try again." };
  }

  revalidatePath(`/dashboard/projects/${input.projectId}/pages/${input.pageId}`);
  revalidatePath(`/dashboard/projects/${input.projectId}/pages`);
  revalidatePath(`/dashboard/projects/${input.projectId}`);
  return { ok: true, revision: Number(data) };
}


export type EditorAiSectionsResult =
  | { ok: true; nodes: ContentNode[]; credits: number; requestId: string }
  | { ok: false; code: string; message: string };

export async function generateEditorSections(input: {
  projectId: string;
  brief: string;
}): Promise<EditorAiSectionsResult> {
  const result = await generateSectionsWithAi({ projectId: input.projectId, brief: input.brief });
  if (!result.ok) return { ok: false, code: result.code, message: result.message };
  const blocks = Array.isArray(result.data) ? result.data : [];
  const nodes: ContentNode[] = [];
  for (const block of blocks) {
    const parsed = blockSchema.safeParse(block);
    if (parsed.success) nodes.push(smartNodeFromBlock(parsed.data));
  }
  if (nodes.length === 0) {
    return { ok: false, code: "AI_BAD_RESULT", message: "AI did not send a usable section. Try again." };
  }
  return { ok: true, nodes, credits: result.credits, requestId: result.requestId };
}

export type EditorAiTextResult =
  | { ok: true; text: string; credits: number }
  | { ok: false; code: string; message: string };

export async function improveEditorText(input: {
  projectId: string;
  text: string;
  instruction: string;
}): Promise<EditorAiTextResult> {
  const text = input.text.trim();
  if (text.length === 0) {
    return { ok: false, code: "AI_EMPTY", message: "Write something first, then ask AI to help." };
  }
  const result = await writeWithAi({
    projectId: input.projectId,
    taskId: "text.improve",
    text: `${input.instruction.trim()}\n\n${text}`,
    existingText: text,
  });
  if (!result.ok) return { ok: false, code: result.code, message: result.message };
  return { ok: true, text: result.text.trim(), credits: result.credits };
}
