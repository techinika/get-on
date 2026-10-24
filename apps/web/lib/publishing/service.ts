import { buildSite } from "@get-on/publisher";
import { createClient } from "@/lib/supabase/server";
import { invalidateQuickFind } from "@/lib/project-activity";
import {
  readPublishConfig,
  siteAddress,
  siteHostname,
} from "./config";
import {
  buildSiteInput,
  buildSnapshot,
  usedImageIds,
  type SourceMedia,
  type SourcePage,
  type SourceProject,
  type SourceSettings,
} from "./build-input";
import {
  pauseFromSettings,
  redirectsFromRows,
  type RedirectRow,
} from "./live-pointer";
import { createPublishStore } from "./store";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PublishContext = {
  supabase: Supabase;
  user: { id: string };
  team: { teamId: string; planId: string };
  project: { id: string; name: string; subdomain: string };
  /** The admin console publishes without the normal per-project rate limit. */
  bypassRateLimit?: boolean;
};

export class PublishError extends Error {
  code: string;
  publishId?: string;
  constructor(code: string, publishId?: string) {
    super(code);
    this.code = code;
    this.publishId = publishId;
  }
}

export type PublishResult = {
  publishId: string;
  status: "live" | "no_changes";
  url: string;
  warnings: string[];
  pagesCount: number;
  sizeBytes: number;
};

type LoadedSite = {
  project: SourceProject & {
    content_revision: number;
    review_state: string;
    suspended_reason: string | null;
    primary_host: string | null;
    redirect_free_address: boolean;
  };
  settings: SourceSettings | null;
  pages: SourcePage[];
  media: SourceMedia[];
  /** The plugins that are switched on for the website. */
  activePlugins: string[];
  redirects: RedirectRow[];
};

function asProject(row: Record<string, unknown>): LoadedSite["project"] {
  return {
    id: String(row.id),
    name: String(row.name),
    subdomain: String(row.subdomain),
    settings: row.settings ?? {},
    content_revision: Number(row.content_revision ?? 0),
    review_state: String(row.review_state ?? "none"),
    suspended_reason: (row.suspended_reason as string | null) ?? null,
    primary_host:
      typeof row.primary_host === "string" ? row.primary_host : null,
    redirect_free_address: row.redirect_free_address !== false,
  };
}

async function loadSite(
  supabase: Supabase,
  projectId: string,
): Promise<LoadedSite | null> {
  const { data: row, error } = await supabase
    .from("projects")
    .select(
      "id, name, subdomain, settings, content_revision, review_state, suspended_reason, primary_host, redirect_free_address",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error || !row) return null;
  const project = asProject(row as Record<string, unknown>);

  const [
    { data: settings },
    { data: pages },
    { data: media },
    { data: installs },
    { data: redirects },
  ] = await Promise.all([
      supabase
        .from("project_settings")
        .select(
          "theme, show_watermark, seo_site_title, seo_description, seo_title_format, social_image_url, search_indexing, tagline, timezone, theme_color, twitter_handle, address_parts, verification, maintenance, custom_404",
        )
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("pages")
        .select(
          "id, title, path, position, is_homepage, blocks, show_in_menu, is_hidden, seo_title, seo_description, hide_from_search",
        )
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      supabase
        .from("media")
        .select("id, path, alt, width, height, mime")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      supabase
        .from("plugin_installs")
        .select("plugin_id, state")
        .eq("project_id", projectId)
        .eq("state", "active"),
      supabase
        .from("redirects")
        .select("from_path, to_value, code")
        .eq("project_id", projectId),
    ]);

  const activePlugins = (installs ?? []).map((row) =>
    String((row as { plugin_id: unknown }).plugin_id),
  );

  return {
    project,
    settings: (settings as SourceSettings | null) ?? null,
    pages: (pages ?? []) as SourcePage[],
    media: (media ?? []) as SourceMedia[],
    activePlugins,
    redirects: (redirects ?? []) as RedirectRow[],
  };
}

async function readImageBytes(
  supabase: Supabase,
  media: SourceMedia[],
): Promise<Map<string, Uint8Array>> {
  const bytes = new Map<string, Uint8Array>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, media.length) }, async () => {
    while (cursor < media.length) {
      const item = media[cursor]!;
      cursor += 1;
      try {
        const { data, error } = await supabase.storage
          .from("project-media")
          .download(item.path);
        if (!error && data) {
          bytes.set(item.id, new Uint8Array(await data.arrayBuffer()));
        }
      } catch {
        // A missing picture only means it is left out of the site.
      }
    }
  });
  await Promise.all(workers);
  return bytes;
}

/** Publishes the current pages and settings, then flips the live pointer. */
export async function publishProject(
  ctx: PublishContext,
): Promise<PublishResult> {
  const config = readPublishConfig();
  const loaded = await loadSite(ctx.supabase, ctx.project.id);
  if (!loaded) throw new PublishError("PROJECT_NOT_FOUND");

  const { project, settings, pages, media, activePlugins, redirects } = loaded;
  if (project.suspended_reason) {
    throw new PublishError("SUSPENDED");
  }
  if (project.review_state === "pending") {
    throw new PublishError("UNDER_REVIEW");
  }

  if (!ctx.bypassRateLimit) {
    const { data: rateOk, error: rateError } = await ctx.supabase.rpc(
      "publish_rate_ok",
      {
        p_project_id: project.id,
        p_max: 10,
        p_window_minutes: 60,
      },
    );
    if (rateError) throw new PublishError("UNKNOWN");
    if (rateOk !== true) throw new PublishError("PUBLISH_RATE_LIMITED");
  }

  const { data: hasChanges, error: changesError } = await ctx.supabase.rpc(
    "project_has_unpublished_changes",
    { p_project_id: project.id },
  );
  if (changesError) throw new PublishError("UNKNOWN");
  if (hasChanges !== true) {
    return {
      publishId: "",
      status: "no_changes",
      url: siteAddress(config, project.subdomain),
      warnings: [],
      pagesCount: pages.filter((page) => !page.is_hidden).length,
      sizeBytes: 0,
    };
  }

  const { data: publishRow, error: insertError } = await ctx.supabase
    .from("publishes")
    .insert({
      project_id: project.id,
      status: "building",
      content_revision: project.content_revision,
      snapshot: buildSnapshot(project, settings, pages),
      pages_count: pages.filter((page) => !page.is_hidden).length,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (insertError || !publishRow) throw new PublishError("UNKNOWN");
  const publishId = String(publishRow.id);

  try {
    const wantedImages = usedImageIds(pages);
    const usedMedia = media.filter((item) => wantedImages.has(item.id));
    const imageBytes = await readImageBytes(ctx.supabase, usedMedia);
    const builtAt = new Date();

    const input = buildSiteInput({
      project,
      projectSettings: settings,
      pages,
      media: usedMedia,
      imageBytes,
      planId: ctx.team.planId,
      publishId,
      rootDomain:
        config.kind === "local" ? config.localRootDomain : config.rootDomain,
      primaryHost: project.primary_host,
      activePlugins,
      builtAt,
    });

    const result = await buildSite(input);
    const store = createPublishStore(config);

    await store.writeShared(result.shared);

    const pagesCount = input.pages.filter((page) => !page.hidden).length;
    const { error: readyError } = await ctx.supabase
      .from("publishes")
      .update({
        status: "ready",
        pages_count: pagesCount,
        size_bytes: result.totalBytes,
        forms: result.forms,
        plugins: activePlugins,
      })
      .eq("id", publishId);
    if (readyError) throw new PublishError("PUBLISH_FAILED", publishId);

    await store.writeVersion(project.id, publishId, result.files);

    const hostname = siteHostname(config, project.subdomain);
    await store.writePointer(hostname, {
      siteId: project.id,
      publishId,
      state: "live",
      builtAt: builtAt.toISOString(),
      plan: ctx.team.planId,
      pause: pauseFromSettings(settings?.maintenance),
      redirects: redirectsFromRows(redirects),
      primaryHost: project.primary_host ?? null,
      freeHost: hostname,
      redirectToPrimary: project.redirect_free_address,
    });

    const now = new Date().toISOString();
    await ctx.supabase
      .from("publishes")
      .update({ status: "superseded" })
      .eq("project_id", project.id)
      .eq("status", "live");
    const { error: liveError } = await ctx.supabase
      .from("publishes")
      .update({ status: "live", live_at: now, finished_at: now })
      .eq("id", publishId);
    if (liveError) {
      console.error("[publish] pointer is live but the row could not be updated", liveError);
    }
    await ctx.supabase
      .from("projects")
      .update({ status: "published" })
      .eq("id", project.id);

    invalidateQuickFind(ctx.team.teamId);

    return {
      publishId,
      status: "live",
      url: siteAddress(config, project.subdomain),
      warnings: result.warnings,
      pagesCount,
      sizeBytes: result.totalBytes,
    };
  } catch (error) {
    const code = error instanceof PublishError ? error.code : "PUBLISH_FAILED";
    await ctx.supabase
      .from("publishes")
      .update({
        status: "failed",
        error_code: code,
        error_message:
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
        finished_at: new Date().toISOString(),
      })
      .eq("id", publishId);
    if (error instanceof PublishError) throw error;
    console.error("[publish] failed", error);
    throw new PublishError(code, publishId);
  }
}

/** Takes a live website offline without deleting its files or history. */
export async function unpublishProject(ctx: PublishContext): Promise<void> {
  const config = readPublishConfig();
  const loaded = await loadSite(ctx.supabase, ctx.project.id);
  if (!loaded) throw new PublishError("PROJECT_NOT_FOUND");

  const { data: live } = await ctx.supabase
    .from("publishes")
    .select("id, live_at, finished_at, created_at")
    .eq("project_id", ctx.project.id)
    .eq("status", "live")
    .maybeSingle();
  if (!live) throw new PublishError("NO_LIVE_VERSION");

  const store = createPublishStore(config);
  await store.writePointer(
    siteHostname(config, loaded.project.subdomain),
    {
      siteId: ctx.project.id,
      publishId: String(live.id),
      state: "unpublished",
      builtAt: String(live.live_at ?? live.finished_at ?? live.created_at),
      plan: ctx.team.planId,
    },
  );

  await ctx.supabase
    .from("publishes")
    .update({ status: "offline" })
    .eq("id", live.id);
  await ctx.supabase
    .from("projects")
    .update({ status: "draft" })
    .eq("id", ctx.project.id);
  invalidateQuickFind(ctx.team.teamId);
}

export type RestoreResult = { publishId: string; url: string };

/** Flips the pointer back to an earlier successful version. */
export async function restorePublish(
  ctx: PublishContext,
  publishId: string,
): Promise<RestoreResult> {
  const config = readPublishConfig();
  const loaded = await loadSite(ctx.supabase, ctx.project.id);
  if (!loaded) throw new PublishError("PROJECT_NOT_FOUND");

  const { data: target } = await ctx.supabase
    .from("publishes")
    .select("id, status, live_at, finished_at, created_at, size_bytes")
    .eq("id", publishId)
    .eq("project_id", ctx.project.id)
    .maybeSingle();
  if (!target) throw new PublishError("PUBLISH_NOT_FOUND");
  if (target.status === "live") {
    return {
      publishId: String(target.id),
      url: siteAddress(config, loaded.project.subdomain),
    };
  }
  if (!["offline", "superseded"].includes(String(target.status))) {
    throw new PublishError("PUBLISH_NOT_RESTORABLE");
  }

  const store = createPublishStore(config);
  await store.writePointer(
    siteHostname(config, loaded.project.subdomain),
    {
      siteId: ctx.project.id,
      publishId: String(target.id),
      state: "live",
      builtAt: String(target.live_at ?? target.finished_at ?? target.created_at),
      plan: ctx.team.planId,
      pause: pauseFromSettings(loaded.settings?.maintenance),
      redirects: redirectsFromRows(loaded.redirects),
    },
  );

  const now = new Date().toISOString();
  await ctx.supabase
    .from("publishes")
    .update({ status: "superseded" })
    .eq("project_id", ctx.project.id)
    .eq("status", "live");
  const { error } = await ctx.supabase
    .from("publishes")
    .update({ status: "live", live_at: now })
    .eq("id", target.id);
  if (error) {
    console.error("[publish] pointer restored but the row could not be updated", error);
  }
  await ctx.supabase
    .from("projects")
    .update({ status: "published" })
    .eq("id", ctx.project.id);
  invalidateQuickFind(ctx.team.teamId);

  return {
    publishId: String(target.id),
    url: siteAddress(config, loaded.project.subdomain),
  };
}
