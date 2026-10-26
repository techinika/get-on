import { NextResponse } from "next/server";
import { hasPageCapacity, PAGE_COLUMNS, requireProject } from "./_lib";
import { invalidateQuickFind, touchProject } from "@/lib/project-activity";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";

type Params = { params: Promise<{ projectId: string }> };

function slugify(input: string): string {
  return (
    "/" +
    input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (!can(ctx.current.team.role, "page.edit")) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    path?: string;
  } | null;
  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  const path = (body?.path ? slugify(body.path) : slugify(title)) || "/";
  if (path !== "/" && (path.length < 2 || !/^\/[a-z0-9-]+$/.test(path))) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  if (!(await hasPageCapacity(ctx))) {
    return NextResponse.json({ error: "LIMIT_PAGES_REACHED" }, { status: 403 });
  }

  const { data: existing } = await ctx.supabase
    .from("pages")
    .select("id")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "PAGE_PATH_TAKEN" }, { status: 409 });
  }

  const { data: maxRow } = await ctx.supabase
    .from("pages")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: page, error } = await ctx.supabase
    .from("pages")
    .insert({
      project_id: projectId,
      title,
      path,
      position: (maxRow?.position ?? -1) + 1,
      is_homepage: false,
      blocks: [],
      updated_by: ctx.current.user.id,
    })
    .select(PAGE_COLUMNS)
    .single();

  if (error || !page) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  await touchProject(ctx.supabase, projectId);
  await logActivity({
    projectId,
    actorUserId: ctx.current.user.id,
    event: "page_created",
    summary: `${ctx.current.user.email ?? "Someone"} added the page ${page.title}`,
    meta: { pageId: page.id },
  });
  invalidateQuickFind(ctx.current.team.teamId);

  return NextResponse.json({ page }, { status: 201 });
}
