"use server";

import { revalidatePath } from "next/cache";
import { blockSchema, countNodes, customCodeLimits, smartNodeFromBlock, validateContentV5, type ContentNode, type PageContentV5 } from "@get-on/blocks";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { publicMediaUrl } from "@/lib/media";
import { generatePageWithAi, generateSectionsWithAi, writeWithAi } from "@/lib/ai/actions";

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
  const cssBytes = new TextEncoder().encode(content.css ?? "").length;
  if (cssBytes > 20 * 1024) {
    return { ok: false, code: "TOO_LARGE", message: "Page CSS must be 20 KB or less. Remove some rules and try again." };
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

export async function generateEditorPage(input: {
  projectId: string;
  brief: string;
}): Promise<EditorAiSectionsResult> {
  const result = await generatePageWithAi({ projectId: input.projectId, brief: input.brief });
  if (!result.ok) return { ok: false, code: result.code, message: result.message };
  const blocks = Array.isArray(result.data) ? result.data : [];
  const nodes: ContentNode[] = [];
  for (const block of blocks) {
    const parsed = blockSchema.safeParse(block);
    if (parsed.success) nodes.push(smartNodeFromBlock(parsed.data));
  }
  if (nodes.length === 0) {
    return { ok: false, code: "AI_BAD_RESULT", message: "AI did not send a usable page. Try again." };
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


export type EditorMediaItem = {
  id: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export async function listEditorMedia(projectId: string): Promise<EditorMediaItem[]> {
  const current = await getCurrentTeam();
  if (!current) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("media")
    .select("id, path, width, height, alt")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(120);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    src: publicMediaUrl(String(row.path)),
    alt: String(row.alt ?? ""),
    width: row.width ? Number(row.width) : undefined,
    height: row.height ? Number(row.height) : undefined,
  }));
}

export type SavedPattern = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  content: ContentNode;
  usageCount: number;
};

export type SavedPatternsResult =
  | { ok: true; patterns: SavedPattern[] }
  | { ok: false; message: string };

export async function listEditorPatterns(): Promise<SavedPatternsResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editor_patterns")
    .select("id, name, category, tags, content, usage_count")
    .eq("team_id", current.team.teamId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, message: "Saved patterns are not available yet." };
  return {
    ok: true,
    patterns: (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      content: row.content as ContentNode,
      usageCount: Number(row.usage_count ?? 0),
    })),
  };
}

export type SavePatternResult =
  | { ok: true; pattern: SavedPattern }
  | { ok: false; code: string; message: string };

export async function saveEditorPattern(input: {
  name: string;
  category: string;
  tags: string[];
  node: ContentNode;
}): Promise<SavePatternResult> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, code: "AUTH", message: "Please sign in again." };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, code: "FORBIDDEN", message: "Only editors, admins and the owner can save patterns." };
  }
  const name = input.name.trim().slice(0, 80);
  if (name.length === 0) {
    return { ok: false, code: "INVALID", message: "Give the pattern a name first." };
  }
  if (input.node.type === "page") {
    return { ok: false, code: "INVALID", message: "Choose one section or element to save." };
  }
  const wrapper: PageContentV5 = {
    schemaVersion: 5,
    root: { id: "page", type: "page", props: {}, children: [input.node] },
  };
  const validated = validateContentV5(wrapper);
  const node = validated.ok ? validated.content.root.children?.[0] : undefined;
  if (!validated.ok || !node) {
    return {
      ok: false,
      code: "INVALID",
      message: validated.ok ? "That element cannot be saved." : validated.errors[0]?.message ?? "That element cannot be saved.",
    };
  }
  if (countNodes(node) > 500) {
    return { ok: false, code: "TOO_LARGE", message: "That pattern is too big. Choose a smaller part." };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("editor_patterns")
    .select("id", { count: "exact", head: true })
    .eq("team_id", current.team.teamId);
  const limit = customCodeLimits(current.team.planId).patterns;
  if ((count ?? 0) >= limit) {
    return {
      ok: false,
      code: "PLAN_LIMIT",
      message: `Your plan can keep ${limit} saved patterns. Delete one first, or upgrade.`,
    };
  }

  const tags = input.tags
    .map((tag) => tag.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 8);
  const category = input.category.trim().slice(0, 40) || "My patterns";
  const { data, error } = await supabase
    .from("editor_patterns")
    .insert({
      team_id: current.team.teamId,
      created_by: current.user.id,
      name,
      category,
      tags,
      content: node,
      schema_version: 5,
    })
    .select("id, name, category, tags, content, usage_count")
    .single();
  if (error || !data) {
    return { ok: false, code: "UNKNOWN", message: "That pattern could not be saved. Try again." };
  }
  revalidatePath("/dashboard/projects");
  return {
    ok: true,
    pattern: {
      id: String(data.id),
      name: String(data.name),
      category: String(data.category),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      content: data.content as ContentNode,
      usageCount: Number(data.usage_count ?? 0),
    },
  };
}

export async function recordEditorPatternUse(id: string): Promise<void> {
  const current = await getCurrentTeam();
  if (!current) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("editor_patterns")
    .select("usage_count")
    .eq("id", id)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from("editor_patterns")
    .update({ usage_count: Number(data.usage_count ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("team_id", current.team.teamId);
}

export async function deleteEditorPattern(id: string): Promise<{ ok: boolean; message?: string }> {
  const current = await getCurrentTeam();
  if (!current) return { ok: false, message: "Please sign in again." };
  if (!["owner", "admin", "editor"].includes(current.team.role)) {
    return { ok: false, message: "Only editors, admins and the owner can delete patterns." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("editor_patterns")
    .delete()
    .eq("id", id)
    .eq("team_id", current.team.teamId);
  if (error) return { ok: false, message: "That pattern could not be deleted." };
  return { ok: true };
}
