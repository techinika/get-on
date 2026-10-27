import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readPackage } from "@/lib/site-package/storage";
import { parseContentBytes, SitePackageError } from "@get-on/site-package";
import { createBackup } from "@/lib/site-package/backups";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });
  if (!can(current.team.role, "import.content")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const importId = typeof body.importId === "string" ? body.importId : "";
  const mode = body.mode === "add" ? "add" : "replace";
  if (!importId) return NextResponse.json({ error: "IMPORT_NOT_VALID" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("project_imports")
    .select("id, project_id, team_id, status, r2_key, expires_at, summary")
    .eq("id", importId)
    .maybeSingle();
  if (
    !row ||
    row.team_id !== current.team.teamId ||
    !row.project_id ||
    !row.r2_key ||
    row.status !== "validated"
  ) {
    return NextResponse.json({ error: "IMPORT_NOT_FOUND" }, { status: 404 });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "IMPORT_EXPIRED" }, { status: 410 });
  }

  let document;
  try {
    const bytes = await readPackage("imports", row.r2_key);
    document = parseContentBytes(bytes).document;
  } catch (error) {
    const code = error instanceof SitePackageError ? error.code : "IMPORT_NOT_VALID";
    return NextResponse.json({ error: code }, { status: 422 });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, subdomain, primary_host, settings")
    .eq("id", row.project_id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  try {
    await createBackup(supabase, project, {
      kind: "safety",
      reason: "before_import",
      createdBy: current.user.id,
    });
  } catch {
    return NextResponse.json({ error: "BACKUP_FAILED" }, { status: 500 });
  }

  const pages = document.pages.map((page) => ({
    title: page.title,
    path: page.path,
    position: page.position,
    is_homepage: page.is_homepage,
    blocks: page.blocks,
    show_in_menu: page.show_in_menu,
    is_hidden: page.is_hidden,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    hide_from_search: page.hide_from_search,
  }));
  const search = document.search as Record<string, unknown>;
  const settings = {
    theme: document.look,
    seo_site_title: search.title ?? null,
    seo_description: search.description ?? null,
    seo_title_format: search.titleFormat ?? "{page} | {site}",
    search_indexing: search.indexing !== false,
    twitter_handle: search.twitterHandle ?? null,
    custom_404: document.customNotFound,
  };

  const { data: result, error } = await supabase.rpc("apply_content_import", {
    p_project: row.project_id,
    p_mode: mode,
    p_pages: pages,
    p_settings: settings,
    p_redirects: document.redirects,
    p_plugins: document.plugins,
  });
  if (error) {
    const message = error.message ?? "";
    const code =
      message.match(/IMPORT_NOT_VALID|PROJECT_NOT_FOUND|NOT_ALLOWED|PROJECT_BUSY|PAGE_LIMIT/)?.[0] ??
      "IMPORT_FAILED";
    return NextResponse.json({ error: code }, { status: code === "PROJECT_BUSY" ? 409 : 400 });
  }

  await admin
    .from("project_imports")
    .update({ status: "applied", summary: { ...(row.summary && typeof row.summary === "object" ? row.summary : {}), result } })
    .eq("id", importId);

  return NextResponse.json({
    ok: true,
    mode,
    pages: (result as { pages?: number } | null)?.pages ?? pages.length,
    warnings: [],
  });
}
