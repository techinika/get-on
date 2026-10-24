import { requireSystemTemplate, materializeTemplate } from "@get-on/templates";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type ApplyMode = "full" | "design" | "pages";

export type ApplyTemplateArgs = {
  supabase: SupabaseLike;
  projectId: string;
  teamId: string;
  slug: string;
  mode?: ApplyMode;
  maxPages?: number | null;
  appliedBy?: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  subdomain: string;
  settings: unknown;
  status: string;
};

type PageRow = {
  id: string;
  title: string;
  path: string;
  position: number;
  is_homepage: boolean;
  blocks: unknown;
  show_in_menu?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_hidden?: boolean | null;
  hide_from_search?: boolean | null;
};

export type Snapshot = {
  at: string;
  slug: string;
  theme: unknown;
  pages: Array<{
    title: string;
    path: string;
    position: number;
    isHome: boolean;
    blocks: unknown;
    showInMenu: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    isHidden: boolean;
    hideFromSearch: boolean;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function profileOf(project: ProjectRow) {
  const settings = asRecord(project.settings);
  const contact = asRecord(settings.contact);
  return {
    businessName: project.name,
    description: typeof settings.about === "string" ? settings.about : "",
    phone: typeof contact.phone === "string" ? contact.phone : "",
    email: typeof contact.email === "string" ? contact.email : "",
    address: typeof contact.address === "string" ? contact.address : "",
  };
}

function blockTypes(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block) => (block && typeof block === "object" ? String((block as { type?: unknown }).type ?? "") : ""))
    .filter(Boolean);
}

async function enableContactIfNeeded(supabase: SupabaseLike, projectId: string, blocks: unknown) {
  if (!blockTypes(blocks).includes("contact-form")) return;
  await supabase.rpc("enable_plugin", { p_project_id: projectId, p_plugin_id: "contact" });
}

async function writeSnapshot(
  supabase: SupabaseLike,
  project: ProjectRow,
  slug: string,
  theme: unknown,
): Promise<Snapshot | null> {
  const { data: pages } = await supabase
    .from("pages")
    .select(
      "id, title, path, position, is_homepage, blocks, show_in_menu, seo_title, seo_description, is_hidden, hide_from_search",
    )
    .eq("project_id", project.id)
    .order("position", { ascending: true });

  const rows = (pages ?? []) as PageRow[];
  if (rows.length === 0) return null;

  const snapshot: Snapshot = {
    at: new Date().toISOString(),
    slug,
    theme,
    pages: rows.map((page) => ({
      title: page.title,
      path: page.path,
      position: page.position,
      isHome: page.is_homepage,
      blocks: page.blocks,
      showInMenu: page.show_in_menu !== false,
      seoTitle: page.seo_title ?? null,
      seoDescription: page.seo_description ?? null,
      isHidden: page.is_hidden === true,
      hideFromSearch: page.hide_from_search === true,
    })),
  };

  const settings = asRecord(project.settings);
  await supabase
    .from("projects")
    .update({
      settings: {
        ...settings,
        templateSnapshot: snapshot,
      },
    })
    .eq("id", project.id);

  return snapshot;
}

export async function applyTemplateToProject({
  supabase,
  projectId,
  teamId,
  slug,
  mode = "full",
  maxPages = null,
  appliedBy = null,
}: ApplyTemplateArgs): Promise<
  | { ok: true; homePageId: string; pageCount: number; mode: ApplyMode }
  | { ok: false; error: "NOT_FOUND" | "THEME_FAILED" | "PAGES_FAILED" | "SETTINGS_FAILED" }
> {
  const pkg = requireSystemTemplate(slug);

  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name, subdomain, settings, status")
    .eq("id", projectId)
    .eq("team_id", teamId)
    .maybeSingle();

  const project = projectData as ProjectRow | null;
  if (!project) return { ok: false, error: "NOT_FOUND" };

  const { data: settingsData } = await supabase
    .from("project_settings")
    .select("theme")
    .eq("project_id", project.id)
    .maybeSingle();
  const previousTheme = (settingsData as { theme?: unknown } | null)?.theme ?? null;

  const materialized = materializeTemplate(pkg, {
    profile: profileOf(project),
    maxPages,
  });
  const home = materialized.pages.find((page) => page.isHome) ?? materialized.pages[0]!;

  const snapshot =
    mode === "full"
      ? await writeSnapshot(supabase, project, slug, previousTheme)
      : null;

  if (mode !== "pages") {
    const { error: themeError } = await supabase.from("project_settings").upsert(
      {
        project_id: project.id,
        theme: materialized.theme,
      },
      { onConflict: "project_id" },
    );
    if (themeError) return { ok: false, error: "THEME_FAILED" };
  }

  if (mode !== "design") {
    const { error: deleteError } = await supabase
      .from("pages")
      .delete()
      .eq("project_id", project.id);
    if (deleteError) return { ok: false, error: "PAGES_FAILED" };

    const rows = materialized.pages.map((page) => ({
      id: page.id,
      project_id: project.id,
      title: page.title,
      path: page.path,
      position: page.position,
      is_homepage: page.isHome,
      blocks: page.blocks,
      show_in_menu: page.showInMenu,
      seo_title: page.seoTitle || null,
      seo_description: page.seoDescription || null,
      is_hidden: false,
      hide_from_search: false,
    }));

    const { error: pageError } = await supabase.from("pages").insert(rows);
    if (pageError) return { ok: false, error: "PAGES_FAILED" };

    await enableContactIfNeeded(supabase, project.id, home.blocks);
  }

  const settings = asRecord(project.settings);
  const nextSettings = {
    ...settings,
    templateOrigin: {
      slug,
      name: pkg.meta.name,
      version: 1,
      appliedAt: new Date().toISOString(),
      mode,
      snapshotAt: snapshot?.at ?? null,
    },
  };

  const { error: settingsError } = await supabase
    .from("projects")
    .update({ settings: nextSettings })
    .eq("id", project.id);
  if (settingsError) return { ok: false, error: "SETTINGS_FAILED" };

  void appliedBy;

  return { ok: true, homePageId: home.id, pageCount: materialized.pages.length, mode };
}

export async function restoreTemplateSnapshot({
  supabase,
  projectId,
  teamId,
}: {
  supabase: SupabaseLike;
  projectId: string;
  teamId: string;
}): Promise<{ ok: true; homePageId: string } | { ok: false; error: string }> {
  const { data: projectData } = await supabase
    .from("projects")
    .select("id, settings")
    .eq("id", projectId)
    .eq("team_id", teamId)
    .maybeSingle();
  const project = projectData as { id: string; settings: unknown } | null;
  if (!project) return { ok: false, error: "NOT_FOUND" };

  const settings = asRecord(project.settings);
  const snapshot = asRecord(settings.templateSnapshot) as unknown as Snapshot;
  if (!snapshot || !Array.isArray(snapshot.pages) || snapshot.pages.length === 0) {
    return { ok: false, error: "NO_SNAPSHOT" };
  }

  if (snapshot.theme) {
    const { error } = await supabase.from("project_settings").upsert(
      { project_id: project.id, theme: snapshot.theme },
      { onConflict: "project_id" },
    );
    if (error) return { ok: false, error: "THEME_FAILED" };
  }

  const { error: deleteError } = await supabase.from("pages").delete().eq("project_id", project.id);
  if (deleteError) return { ok: false, error: "PAGES_FAILED" };

  const rows = snapshot.pages.map((page) => ({
    project_id: project.id,
    title: page.title,
    path: page.path,
    position: page.position,
    is_homepage: page.isHome,
    blocks: page.blocks,
    show_in_menu: page.showInMenu,
    seo_title: page.seoTitle,
    seo_description: page.seoDescription,
    is_hidden: page.isHidden,
    hide_from_search: page.hideFromSearch,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("pages")
    .insert(rows)
    .select("id, is_homepage")
    .order("position", { ascending: true });
  if (insertError) return { ok: false, error: "PAGES_FAILED" };

  const rest = { ...settings };
  delete rest.templateSnapshot;
  delete rest.templateOrigin;
  await supabase.from("projects").update({ settings: rest }).eq("id", project.id);

  const home =
    ((inserted ?? []) as Array<{ id: string; is_homepage: boolean }>).find((page) => page.is_homepage) ??
    ((inserted ?? []) as Array<{ id: string; is_homepage: boolean }>)[0];
  if (!home) return { ok: false, error: "PAGES_FAILED" };
  return { ok: true, homePageId: home.id };
}

export function snapshotOf(settings: unknown): Snapshot | null {
  const record = asRecord(settings);
  const value = asRecord(record.templateSnapshot);
  if (!Array.isArray(value.pages) || value.pages.length === 0) return null;
  return value as unknown as Snapshot;
}

export function templateOriginOf(settings: unknown): { slug: string; name?: string; appliedAt?: string } | null {
  const record = asRecord(settings);
  const origin = asRecord(record.templateOrigin);
  if (typeof origin.slug !== "string") return null;
  return {
    slug: origin.slug,
    name: typeof origin.name === "string" ? origin.name : undefined,
    appliedAt: typeof origin.appliedAt === "string" ? origin.appliedAt : undefined,
  };
}
