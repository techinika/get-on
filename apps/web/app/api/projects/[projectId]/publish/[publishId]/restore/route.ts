import { NextResponse } from "next/server";
import { requireProject } from "../../../pages/_lib";
import { restorePublish, PublishError } from "@/lib/publishing/service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ projectId: string; publishId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { projectId, publishId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  try {
    const result = await restorePublish(
      {
        supabase: ctx.supabase,
        user: { id: ctx.current.user.id },
        team: {
          teamId: ctx.current.team.teamId,
          planId: ctx.current.team.planId,
        },
        project: ctx.project,
      },
      publishId,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PublishError) {
      const status =
        error.code === "PUBLISH_NOT_FOUND"
          ? 404
          : error.code === "PUBLISH_NOT_RESTORABLE" ||
              error.code === "PLAN_PAUSED"
            ? 409
            : error.code === "PUBLISH_NOT_CONFIGURED"
              ? 503
              : 500;
      return NextResponse.json({ error: error.code }, { status });
    }
    console.error("[publish] restore failed", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
