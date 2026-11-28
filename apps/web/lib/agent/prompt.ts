import type { AgentMessage } from "./conversations";

export type AgentWebsiteSummary = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
};

export type AgentPageSummary = {
  id: string;
  title: string;
  path: string;
  isHomepage: boolean;
  revision?: number;
};

export type AgentPageContext = {
  route: string;
  pageTitle: string;
  projectName: string;
  teamName: string;
  projectId?: string | null;
  siteState?: string;
  published?: boolean;
  hasUnpublishedChanges?: boolean;
  pageCount?: number;
  primaryAddress?: string;
  tagline?: string;
  planId?: string;
  planName?: string;
  credits?: number;
  activeWebsites?: number;
  maxWebsites?: number | null;
  maxPagesPerSite?: number | null;
  maxPlugins?: number | null;
  storageMb?: number | null;
  customDomainAllowed?: boolean;
  websites?: AgentWebsiteSummary[];
  pages?: AgentPageSummary[];
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
  function optionalText(key: string, max: number): string | undefined {
    const raw = input[key];
    return typeof raw === "string"
      ? raw.replace(/\s+/g, " ").trim().slice(0, max) || undefined
      : undefined;
  }
  function optionalBool(key: string): boolean | undefined {
    const raw = input[key];
    if (typeof raw === "boolean") return raw;
    return undefined;
  }
  return {
    ...fallback,
    route: text("route", 240) || fallback.route,
    pageTitle: text("pageTitle", 120) || fallback.pageTitle,
    projectName: text("projectName", 120) || fallback.projectName,
    teamName: text("teamName", 120) || fallback.teamName,
    siteState: optionalText("siteState", 40) ?? fallback.siteState,
    published: optionalBool("published") ?? fallback.published,
    hasUnpublishedChanges:
      optionalBool("hasUnpublishedChanges") ?? fallback.hasUnpublishedChanges,
    pageCount:
      typeof input.pageCount === "number" && Number.isFinite(input.pageCount)
        ? input.pageCount
        : fallback.pageCount,
    primaryAddress: optionalText("primaryAddress", 240) ?? fallback.primaryAddress,
    tagline: optionalText("tagline", 160) ?? fallback.tagline,
  };
}

function formatLimit(value: number | null | undefined): string {
  return value === null ? "unlimited" : value === undefined ? "unknown" : String(value);
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

  const websiteList =
    Array.isArray(context.websites) && context.websites.length > 0
      ? context.websites
          .slice(0, 12)
          .map((site) => `${site.name} (${site.subdomain}.get-on.tech, ${site.status}, id:${site.id})`)
          .join("; ")
      : "";

  const pageList =
    Array.isArray(context.pages) && context.pages.length > 0
      ? context.pages
          .slice(0, 15)
          .map(
            (page) =>
              `${page.title} (${page.path}${page.isHomepage ? ", homepage" : ""}, id:${page.id}${typeof page.revision === "number" ? `, rev:${page.revision}` : ""})`,
          )
          .join("; ")
      : "";

  const contextLines = [
    context.teamName ? `Team: ${context.teamName}` : "",
    context.planId
      ? `Plan: ${context.planName ?? context.planId} (${context.planId})`
      : "",
    context.credits !== undefined ? `AI credits remaining: ${context.credits}` : "",
    context.activeWebsites !== undefined
      ? `Websites: ${context.activeWebsites} of ${formatLimit(context.maxWebsites)}`
      : context.maxWebsites !== undefined
        ? `Website limit: ${formatLimit(context.maxWebsites)}`
        : "",
    context.maxPagesPerSite !== undefined
      ? `Pages per website limit: ${formatLimit(context.maxPagesPerSite)}`
      : "",
    context.maxPlugins !== undefined
      ? `Plugins per website limit: ${formatLimit(context.maxPlugins)}`
      : "",
    context.storageMb !== undefined
      ? `Storage limit: ${context.storageMb === null ? "unlimited" : `${context.storageMb} MB`}`
      : "",
    context.customDomainAllowed !== undefined
      ? `Custom domains allowed: ${context.customDomainAllowed ? "yes" : "no"}`
      : "",
    context.projectName
      ? `Website: ${context.projectName}${context.projectId ? ` (id:${context.projectId})` : ""}`
      : "",
    context.primaryAddress ? `Address: ${context.primaryAddress}` : "",
    context.tagline ? `Tagline: ${context.tagline}` : "",
    context.siteState ? `Site state: ${context.siteState}` : "",
    context.published !== undefined
      ? `Published: ${context.published ? "yes" : "no"}`
      : "",
    context.hasUnpublishedChanges !== undefined
      ? `Unpublished changes: ${context.hasUnpublishedChanges ? "yes" : "no"}`
      : "",
    context.pageCount !== undefined
      ? `Pages: ${context.pageCount}`
      : "",
    pageList ? `Current website pages: ${pageList}` : "",
    websiteList ? `Team websites: ${websiteList}` : "",
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
