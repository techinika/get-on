"use server";

import { revalidatePath } from "next/cache";
import { validateContentV5, type PageContentV5 } from "@get-on/blocks";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

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
