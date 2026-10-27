import { randomInt } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";
import { planLimits } from "@/lib/plans";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import { writeLink, type LinkValue } from "./kv";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type TrackedLinkRow = {
  id: string;
  project_id: string;
  code: string;
  target_path: string;
  label: string | null;
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  content: string | null;
  params: Record<string, string> | null;
  created_at: string;
  revoked_at: string | null;
  last_clicked_at: string | null;
};

export type LinkProject = {
  id: string;
  subdomain: string;
  primary_host: string | null;
};

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 8;

function makeCode(): string {
  let out = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\r\n]/g, " ").trim().slice(0, max);
  return text || null;
}

function paramsFor(row: {
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  content: string | null;
}): Record<string, string> {
  const params: Record<string, string> = {};
  params.utm_source = row.source;
  params.utm_medium = row.medium;
  if (row.campaign) params.utm_campaign = row.campaign;
  if (row.term) params.utm_term = row.term;
  if (row.content) params.utm_content = row.content;
  return params;
}

export function shortLinkFor(project: LinkProject, code: string): string {
  return `${primaryAddress(readPublishConfig(), project.subdomain, project.primary_host)}/_l/${code}`;
}

export async function assertTargetPage(
  supabase: Supabase,
  projectId: string,
  targetPath: string,
): Promise<string> {
  const path = targetPath.trim();
  if (
    !path ||
    path === "" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("..") ||
    path.includes("\\") ||
    /[?#\r\n]/.test(path)
  ) {
    throw new Error("LINK_TARGET_INVALID");
  }
  const { data } = await supabase
    .from("pages")
    .select("path")
    .eq("project_id", projectId)
    .eq("path", path)
    .eq("is_hidden", false)
    .maybeSingle();
  if (!data) throw new Error("LINK_TARGET_INVALID");
  return path;
}

export async function createTrackedLink(
  supabase: Supabase,
  project: LinkProject,
  planId: string,
  input: {
    targetPath: string;
    label?: unknown;
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    term?: unknown;
    content?: unknown;
    createdBy: string;
  },
): Promise<TrackedLinkRow> {
  const plan = planLimits(planId);
  if (plan.trackedLinksMax <= 0) throw new Error("LINKS_NOT_INCLUDED");
  const targetPath = await assertTargetPage(supabase, project.id, input.targetPath);
  const { count } = await supabase
    .from("tracked_links")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= plan.trackedLinksMax) throw new Error("LINK_LIMIT_REACHED");

  const row = {
    source: clean(input.source, 100) ?? "direct",
    medium: clean(input.medium, 100) ?? "link",
    campaign: clean(input.campaign, 200),
    term: clean(input.term, 200),
    content: clean(input.content, 200),
  };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeCode();
    const { data, error } = await supabase
      .from("tracked_links")
      .insert({
        project_id: project.id,
        code,
        target_path: targetPath,
        label: clean(input.label, 60),
        ...row,
        params: paramsFor(row),
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue;
      throw new Error("LINK_CREATE_FAILED");
    }
    const created = data as TrackedLinkRow;
    try {
      await writeLink(code, linkValue(created));
    } catch {
      await supabase.from("tracked_links").delete().eq("id", created.id);
      throw new Error("LINK_WRITE_FAILED");
    }
    return created;
  }
  throw new Error("LINK_CREATE_FAILED");
}

export function linkValue(row: TrackedLinkRow): LinkValue {
  return {
    v: 1,
    siteId: row.project_id,
    projectId: row.project_id,
    targetPath: row.target_path,
    params: row.params ?? {},
    active: row.revoked_at === null,
  };
}

export async function updateTrackedLink(
  supabase: Supabase,
  projectId: string,
  linkId: string,
  input: {
    targetPath?: unknown;
    label?: unknown;
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    term?: unknown;
    content?: unknown;
    active?: unknown;
  },
): Promise<TrackedLinkRow> {
  const { data: existing } = await supabase
    .from("tracked_links")
    .select("*")
    .eq("id", linkId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!existing) throw new Error("LINK_NOT_FOUND");
  const row = existing as TrackedLinkRow;
  const targetPath =
    input.targetPath === undefined
      ? row.target_path
      : await assertTargetPage(supabase, projectId, String(input.targetPath));
  const next: {
    target_path: string;
    label: string | null;
    source: string;
    medium: string;
    campaign: string | null;
    term: string | null;
    content: string | null;
    revoked_at: string | null;
    params?: Record<string, string>;
  } = {
    target_path: targetPath,
    label: input.label === undefined ? row.label : clean(input.label, 60),
    source: input.source === undefined ? row.source : clean(input.source, 100) ?? "direct",
    medium: input.medium === undefined ? row.medium : clean(input.medium, 100) ?? "link",
    campaign: input.campaign === undefined ? row.campaign : clean(input.campaign, 200),
    term: input.term === undefined ? row.term : clean(input.term, 200),
    content: input.content === undefined ? row.content : clean(input.content, 200),
    revoked_at:
      input.active === undefined
        ? row.revoked_at
        : input.active === true
          ? null
          : new Date().toISOString(),
  };
  next.params = paramsFor(next);
  const { data, error } = await supabase
    .from("tracked_links")
    .update(next)
    .eq("id", linkId)
    .eq("project_id", projectId)
    .select("*")
    .single();
  if (error || !data) throw new Error("LINK_UPDATE_FAILED");
  const updated = data as TrackedLinkRow;
  await writeLink(updated.code, linkValue(updated));
  return updated;
}

export async function deleteTrackedLink(
  supabase: Supabase,
  projectId: string,
  linkId: string,
): Promise<void> {
  const { data } = await supabase
    .from("tracked_links")
    .select("code")
    .eq("id", linkId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) throw new Error("LINK_NOT_FOUND");
  const { error } = await supabase
    .from("tracked_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", projectId);
  if (error) throw new Error("LINK_DELETE_FAILED");
  await writeLink(String(data.code), null);
}
