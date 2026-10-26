"use server";

import type { AiTaskId } from "@get-on/ai";
import { MEDIA_BUCKET } from "@/lib/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeam } from "@/lib/team";
import { runTask, type RunTextTaskResult } from "./pipeline";
import { runImageTask, type RunImageTaskResult } from "./image-pipeline";

export type AiTextActionResult =
  | RunTextTaskResult
  | { ok: false; code: "AUTH" | "FORBIDDEN"; message: string };

export type AiTextActionInput = {
  taskId: AiTaskId;
  projectId?: string | null;
  text: string;
  existingText?: string;
};

export type AiSectionActionInput = {
  projectId?: string | null;
  brief: string;
  existingText?: string;
};

export type AiSectionActionResult =
  | RunTextTaskResult
  | { ok: false; code: "AUTH" | "FORBIDDEN"; message: string };

export type AiPageActionInput = {
  projectId?: string | null;
  brief: string;
  existingText?: string;
};

export type AiPageActionResult =
  | RunTextTaskResult
  | { ok: false; code: "AUTH" | "FORBIDDEN"; message: string };

export type AiImageActionInput = {
  projectId: string;
  prompt: string;
};

export type AiDescribeImageInput = {
  projectId: string;
  mediaId: string;
};

export type AiDescribeImageResult =
  | RunTextTaskResult
  | { ok: false; code: "AUTH" | "FORBIDDEN"; message: string };

export type AiImageActionResult =
  | RunImageTaskResult
  | { ok: false; code: "AUTH" | "FORBIDDEN"; message: string };

export async function writeWithAi(
  input: AiTextActionInput,
): Promise<AiTextActionResult> {
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
  if (input.text.trim().length === 0) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Please write a few words first.",
    };
  }
  if (input.text.length > 20000 || (input.existingText?.length ?? 0) > 20000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That is too long for AI to work with. Try a shorter piece.",
    };
  }

  return runTask(input.taskId, {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId ?? null,
    userInput: input.text,
    existingText: input.existingText,
  });
}

export async function generateSectionsWithAi(
  input: AiSectionActionInput,
): Promise<AiSectionActionResult> {
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
  if (input.brief.trim().length === 0) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Please describe the section you want first.",
    };
  }
  if (input.brief.length > 20000 || (input.existingText?.length ?? 0) > 20000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That is too long for AI to work with. Try a shorter description.",
    };
  }

  return runTask("section.generate", {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId ?? null,
    userInput: input.brief,
    existingText: input.existingText,
  });
}

export async function generateImageWithAi(
  input: AiImageActionInput,
): Promise<AiImageActionResult> {
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
  if (input.prompt.trim().length === 0) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Please describe the picture you want first.",
    };
  }
  if (input.prompt.length > 2000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That is too long for AI to work with. Try a shorter description.",
    };
  }

  return runImageTask({
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId,
    prompt: input.prompt,
  });
}

export async function generatePageWithAi(
  input: AiPageActionInput,
): Promise<AiPageActionResult> {
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
  if (input.brief.trim().length === 0) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "Please describe the page you want first.",
    };
  }
  if (input.brief.length > 20000 || (input.existingText?.length ?? 0) > 20000) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That is too long for AI to work with. Try a shorter description.",
    };
  }

  return runTask("page.generate", {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId ?? null,
    userInput: input.brief,
    existingText: input.existingText,
  });
}

export async function describeImageWithAi(
  input: AiDescribeImageInput,
): Promise<AiDescribeImageResult> {
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

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("team_id, deleted_at")
    .eq("id", input.projectId)
    .maybeSingle();
  if (
    !project ||
    project.team_id !== current.team.teamId ||
    project.deleted_at
  ) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "We could not find that website.",
    };
  }

  const { data: media } = await admin
    .from("media")
    .select("path, mime, size_bytes")
    .eq("id", input.mediaId)
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!media?.path) {
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We could not find that picture.",
    };
  }
  if (typeof media.size_bytes === "number" && media.size_bytes > 10 * 1024 * 1024) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That picture is too large for AI to look at.",
    };
  }

  const { data: file, error } = await admin.storage
    .from(MEDIA_BUCKET)
    .download(media.path);
  if (error || !file) {
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We could not open that picture. Please try again.",
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) {
    return {
      ok: false,
      code: "AI_TOO_LONG",
      message: "That picture is too large for AI to look at.",
    };
  }

  return runTask("alt.describe", {
    teamId: current.team.teamId,
    userId: current.user.id,
    projectId: input.projectId,
    userInput: "Describe this picture for someone who cannot see it.",
    image: {
      base64: buffer.toString("base64"),
      mime: media.mime || file.type || "image/jpeg",
    },
  });
}
