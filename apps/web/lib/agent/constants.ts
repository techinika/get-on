export const ASSISTANT_OPEN_COOKIE = "gs_assistant";
export const ASSISTANT_TAB_COOKIE = "gs_assistant_tab";
export const ASSISTANT_WIDTH_COOKIE = "gs_assistant_width";

export const ASSISTANT_MIN_WIDTH = 320;
export const ASSISTANT_MAX_WIDTH = 720;
export const ASSISTANT_DEFAULT_WIDTH = 400;
export const ASSISTANT_CHAT_CREDITS = 1;

export type AssistantTab = "assistant" | "help";

export function clampAssistantWidth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return ASSISTANT_DEFAULT_WIDTH;
  return Math.min(
    ASSISTANT_MAX_WIDTH,
    Math.max(ASSISTANT_MIN_WIDTH, Math.round(parsed)),
  );
}

export function asAssistantTab(value: unknown): AssistantTab {
  return value === "help" ? "help" : "assistant";
}

export function assistantOpenFromCookie(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function assistantTabFromCookie(value: string | undefined): AssistantTab {
  return asAssistantTab(value);
}

export function assistantWidthFromCookie(value: string | undefined): number {
  return clampAssistantWidth(value);
}
