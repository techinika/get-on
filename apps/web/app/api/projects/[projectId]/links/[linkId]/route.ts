import { NextResponse } from "next/server";
import { requireProject } from "../../pages/_lib";
import { can } from "@/lib/permissions";
import { deleteTrackedLink, shortLinkFor, updateTrackedLink } from "@/lib/links/service";

type Params = { params: Promise<{ projectId: string; linkId: string }> };

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: Params) {
  const { projectId, linkId } = await params;
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
    const link = await updateTrackedLink(ctx.supabase, projectId, linkId, {
      targetPath: body.targetPath,
      label: body.label,
      source: body.source,
      medium: body.medium,
      campaign: body.campaign,
      term: body.term,
      content: body.content,
      active: body.active,
    });
    return NextResponse.json({
      link: {
        ...link,
        active: link.revoked_at === null,
        shortUrl: shortLinkFor(ctx.project, link.code),
      },
    });
  } catch (error) {
    const code = (error as Error).message || "LINK_UPDATE_FAILED";
    return NextResponse.json({ error: code }, { status: code === "LINK_NOT_FOUND" ? 404 : 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { projectId, linkId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "links.delete")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  try {
    await deleteTrackedLink(ctx.supabase, projectId, linkId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = (error as Error).message || "LINK_DELETE_FAILED";
    return NextResponse.json({ error: code }, { status: code === "LINK_NOT_FOUND" ? 404 : 400 });
  }
}
