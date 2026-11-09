import {
  ASSISTANT_OPEN_COOKIE,
  ASSISTANT_TAB_COOKIE,
  ASSISTANT_WIDTH_COOKIE,
  type AssistantTab,
} from "./constants";

export type AssistantPreferencePatch = {
  open?: boolean;
  width?: number;
  tab?: AssistantTab;
};

export function writeAssistantCookies(patch: AssistantPreferencePatch): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  if (patch.open !== undefined) {
    document.cookie = `${ASSISTANT_OPEN_COOKIE}=${patch.open ? "1" : "0"}; path=/; max-age=${maxAge}; samesite=lax`;
  }
  if (patch.tab !== undefined) {
    document.cookie = `${ASSISTANT_TAB_COOKIE}=${patch.tab}; path=/; max-age=${maxAge}; samesite=lax`;
  }
  if (patch.width !== undefined) {
    document.cookie = `${ASSISTANT_WIDTH_COOKIE}=${Math.round(patch.width)}; path=/; max-age=${maxAge}; samesite=lax`;
  }
}

export async function saveAssistantPreferences(
  patch: AssistantPreferencePatch,
): Promise<void> {
  writeAssistantCookies(patch);
  try {
    await fetch("/api/agent/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    // The cookie still keeps the layout stable for this device.
  }
}
