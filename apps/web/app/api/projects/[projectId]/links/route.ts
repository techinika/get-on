import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { can } from "@/lib/permissions";
import { createTrackedLink, shortLinkFor } from "@/lib/links/service";

type Params = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "links.view")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const { data } = await ctx.supabase
    .from("tracked_links")
    .select(
      "id, code, target_path, label, source, medium, campaign, term, content, params, created_at, revoked_at, last_clicked_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  const links = (data ?? []).map((row) => ({
    ...row,
    active: row.revoked_at === null,
    shortUrl: shortLinkFor(ctx.project, String(row.code)),
  }));
  return NextResponse.json({ links });
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "links.manage")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const link = await createTrackedLink(
      ctx.supabase,
      ctx.project,
      ctx.current.team.planId,
      {
        targetPath: String(body.targetPath ?? "/"),
        label: body.label,
        source: body.source,
        medium: body.medium,
        campaign: body.campaign,
        term: body.term,
        content: body.content,
        createdBy: ctx.current.user.id,
      },
    );
    return NextResponse.json({
      link: {
        ...link,
        active: link.revoked_at === null,
        shortUrl: shortLinkFor(ctx.project, link.code),
      },
    });
  } catch (error) {
    const code = (error as Error).message || "LINK_CREATE_FAILED";
    const status = code === "LINKS_NOT_INCLUDED" || code === "LINK_LIMIT_REACHED" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }
}
