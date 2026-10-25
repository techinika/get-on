"use server";

import type { AiTaskId } from "@get-on/ai";
import { getCurrentTeam } from "@/lib/team";
import { runTask, type RunTextTaskResult } from "./pipeline";

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
