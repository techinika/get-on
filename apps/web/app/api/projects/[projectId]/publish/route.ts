import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { publishProject, PublishError } from "@/lib/publishing/service";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ projectId: string }> };

const STATUS: Record<string, number> = {
  PROJECT_NOT_FOUND: 404,
  SUSPENDED: 409,
  UNDER_REVIEW: 409,
  PUBLISH_RATE_LIMITED: 429,
  PLAN_INACTIVE: 402,
  PUBLISH_NOT_CONFIGURED: 503,
  PUBLISH_FAILED: 500,
  UPLOAD_FAILED: 502,
  UPLOAD_VERIFY_FAILED: 502,
  POINTER_WRITE_FAILED: 502,
  LIVE_PROBE_FAILED: 502,
};

export async function POST(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  if (ctx.current.team.billingStatus === "lapsed") {
    return NextResponse.json({ error: "PLAN_INACTIVE" }, { status: 402 });
  }

  try {
    const result = await publishProject({
      supabase: ctx.supabase,
      user: { id: ctx.current.user.id },
      team: {
        teamId: ctx.current.team.teamId,
        planId: ctx.current.team.planId,
      },
      project: ctx.project,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        {
          error: error.code,
          ...(error.publishId ? { publishId: error.publishId } : {}),
        },
        { status: STATUS[error.code] ?? 500 },
      );
    }
    console.error("[publish] unexpected error", error);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }
}
