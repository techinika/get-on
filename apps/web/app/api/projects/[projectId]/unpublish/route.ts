import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { unpublishProject, PublishError } from "@/lib/publishing/service";

export const runtime = "nodejs";
export const maxDuration = 30;

type Params = { params: Promise<{ projectId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  try {
    await unpublishProject({
      supabase: ctx.supabase,
      user: { id: ctx.current.user.id },
      team: {
        teamId: ctx.current.team.teamId,
        planId: ctx.current.team.planId,
      },
      project: ctx.project,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PublishError) {
      const status =
        error.code === "NO_LIVE_VERSION"
          ? 409
          : error.code === "PUBLISH_NOT_CONFIGURED"
            ? 503
            : 500;
      return NextResponse.json({ error: error.code }, { status });
    }
    console.error("[publish] unpublish failed", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
