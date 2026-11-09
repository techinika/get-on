import type { AgentMessage } from "./conversations";

export type AgentPageContext = {
  route: string;
  pageTitle: string;
  projectName: string;
  teamName: string;
};

export function normaliseAgentContext(
  value: unknown,
  fallback: AgentPageContext,
): AgentPageContext {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  function text(key: string, max: number): string {
    const raw = input[key];
    return typeof raw === "string"
      ? raw.replace(/\s+/g, " ").trim().slice(0, max)
      : "";
  }
  return {
    route: text("route", 240) || fallback.route,
    pageTitle: text("pageTitle", 120) || fallback.pageTitle,
    projectName: text("projectName", 120) || fallback.projectName,
    teamName: text("teamName", 120) || fallback.teamName,
  };
}

export function buildAgentPrompt(
  messages: AgentMessage[],
  context: AgentPageContext,
  maxChars = 12000,
): string {
  const lines: string[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role === "system" || message.role === "tool") continue;
    const label = message.role === "assistant" ? "Assistant" : "User";
    const line = `${label}: ${message.content.trim()}`;
    if (used + line.length > maxChars && lines.length > 0) break;
    lines.unshift(line);
    used += line.length;
  }

  const contextLines = [
    context.teamName ? `Team: ${context.teamName}` : "",
    context.projectName ? `Website: ${context.projectName}` : "",
    context.route ? `Current route: ${context.route}` : "",
    context.pageTitle ? `Current page: ${context.pageTitle}` : "",
  ].filter(Boolean);

  return [
    "<assistant_context>",
    ...contextLines,
    "</assistant_context>",
    "<conversation>",
    ...lines,
    "</conversation>",
    "Reply to the latest User message. Keep it under 300 words unless the user asks for more.",
  ].join("\n");
}
