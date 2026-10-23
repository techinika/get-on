import { NextResponse } from "next/server";
import { PAGE_COLUMNS, requireProject } from "../_lib";
import { invalidateQuickFind, touchProject } from "@/lib/project-activity";

type Params = { params: Promise<{ projectId: string; pageId: string }> };

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

export async function PATCH(request: Request, { params }: Params) {
  const { projectId, pageId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    path?: string;
    isHomepage?: boolean;
    position?: number;
    blocks?: unknown[];
  } | null;
  if (!body) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  const { data: page } = await ctx.supabase
    .from("pages")
    .select("id, path, is_homepage, position")
    .eq("id", pageId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "PAGE_NOT_FOUND" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.path === "string") {
    const path = slugify(body.path);
    if (path !== "/" && !/^\/[a-z0-9-]+$/.test(path)) {
      return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
    }
    const { data: clash } = await ctx.supabase
      .from("pages")
      .select("id")
      .eq("project_id", projectId)
      .eq("path", path)
      .neq("id", pageId)
      .maybeSingle();
    if (clash) {
      return NextResponse.json({ error: "PAGE_PATH_TAKEN" }, { status: 409 });
    }
    updates.path = path;
  }
  if (typeof body.isHomepage === "boolean" && body.isHomepage && !page.is_homepage) {
    // Demote current homepage to a normal page first.
    const { data: currentHome } = await ctx.supabase
      .from("pages")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_homepage", true)
      .maybeSingle();
    if (currentHome) {
      await ctx.supabase
        .from("pages")
        .update({ is_homepage: false, path: "/home" })
        .eq("id", currentHome.id);
    }
    updates.is_homepage = true;
    updates.path = "/";
  }
  if (typeof body.position === "number" && Number.isFinite(body.position)) {
    updates.position = body.position;
  }
  if (Array.isArray(body.blocks)) {
    updates.blocks = body.blocks;
  }

  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  const { data: updated, error } = await ctx.supabase
    .from("pages")
    .update(updates)
    .eq("id", pageId)
    .select(PAGE_COLUMNS)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  await touchProject(ctx.supabase, projectId);
  invalidateQuickFind(ctx.current.team.teamId);

  return NextResponse.json({ page: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { projectId, pageId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  const { data: page } = await ctx.supabase
    .from("pages")
    .select("id, is_homepage")
    .eq("id", pageId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "PAGE_NOT_FOUND" }, { status: 404 });
  }
  if (page.is_homepage) {
    return NextResponse.json({ error: "PAGE_IS_HOMEPAGE" }, { status: 409 });
  }

  const { error } = await ctx.supabase.from("pages").delete().eq("id", pageId);
  if (error) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  await touchProject(ctx.supabase, projectId);
  invalidateQuickFind(ctx.current.team.teamId);

  return NextResponse.json({ ok: true });
}
