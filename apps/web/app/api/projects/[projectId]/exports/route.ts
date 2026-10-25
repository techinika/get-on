import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";

type Params = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const [{ data: settings }, { data: pages }, { data: redirects }, { data: installs }] =
    await Promise.all([
      ctx.supabase.from("project_settings").select("*").eq("project_id", projectId).maybeSingle(),
      ctx.supabase
        .from("pages")
        .select("id, title, path, position, is_homepage, blocks, show_in_menu, is_hidden, seo_title, seo_description, hide_from_search")
        .eq("project_id", projectId)
        .order("position", { ascending: true }),
      ctx.supabase
        .from("redirects")
        .select("from_path, to_type, to_value, code")
        .eq("project_id", projectId),
      ctx.supabase
        .from("plugin_installs")
        .select("plugin_id, state")
        .eq("project_id", projectId)
        .eq("state", "active"),
    ]);

  const content = {
    profile: {
      name: ctx.project.name,
      address: primaryAddress(
        readPublishConfig(),
        ctx.project.subdomain,
        ctx.project.primary_host,
      ),
    },
    look: settings?.theme ?? {},
    pages: pages ?? [],
    sharedSections: [],
    search: {
      title: settings?.seo_site_title ?? null,
      description: settings?.seo_description ?? null,
      titleFormat: settings?.seo_title_format ?? "{page} | {site}",
      indexing: settings?.search_indexing !== false,
      twitterHandle: settings?.twitter_handle ?? null,
    },
    redirects: redirects ?? [],
    google: settings?.verification ?? {},
    plugins: (installs ?? []).map((row) => row.plugin_id),
    customNotFound: settings?.custom_404 ?? {},
    templateOrigin: null,
  };

  const body = JSON.stringify(
    {
      manifest: {
        format: "getonsite",
        formatVersion: 1,
        createdAt: new Date().toISOString(),
        createdWith: "Get-On",
        kind: "export",
        contentSchemaVersion: 3,
        themeVersion: 1,
        source: {
          name: ctx.project.name,
          address: primaryAddress(
        readPublishConfig(),
        ctx.project.subdomain,
        ctx.project.primary_host,
      ),
        },
        options: { pictures: false, files: false, messages: false },
        counts: { pages: content.pages.length, redirects: content.redirects.length },
        contentHash: "",
        mediaTotalBytes: 0,
      },
      document: content,
    },
    null,
    2,
  );

  const filename = `${ctx.project.subdomain.replace(/[^a-z0-9-]/gi, "-")}-website.json`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "IMPORT_NOT_READY",
      message: "Bringing back a website file is not switched on yet.",
    },
    { status: 503 },
  );
}
