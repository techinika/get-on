"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blockWithIdSchema, migrateContent } from "@get-on/blocks";
import { generateSectionsWithAi, type AiSectionActionResult } from "@/lib/ai/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

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
