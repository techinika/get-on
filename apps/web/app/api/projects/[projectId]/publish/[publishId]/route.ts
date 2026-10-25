import { NextResponse } from "next/server";
import { requireProject } from "../../pages/_lib";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string; publishId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId, publishId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  const { data: publish, error } = await ctx.supabase
    .from("publishes")
    .select(
      "id, status, error_code, pages_count, size_bytes, created_at, finished_at, live_at",
    )
    .eq("id", publishId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  if (!publish) {
    return NextResponse.json({ error: "PUBLISH_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    id: publish.id,
    status: publish.status,
    error: publish.error_code ?? null,
    pagesCount: publish.pages_count,
    sizeBytes: publish.size_bytes,
    createdAt: publish.created_at,
    finishedAt: publish.finished_at,
    liveAt: publish.live_at,
    url: primaryAddress(
      readPublishConfig(),
      ctx.project.subdomain,
      ctx.project.primary_host,
    ),
  });
}
