import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { can } from "@/lib/permissions";
import { planLimits } from "@/lib/plans";
import { createBackup } from "@/lib/site-package/backups";
import { signDownloadToken } from "@/lib/site-package/token";

type Params = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "site.backups")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const { data } = await ctx.supabase
    .from("backups")
    .select(
      "id, kind, label, status, page_count, media_count, media_bytes, pictures_included, messages_included, locked, created_at, expires_at, reason",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  const backups = (data ?? []).map((row) => ({
    ...row,
    downloadUrl:
      row.status === "ready"
        ? `/api/downloads?token=${encodeURIComponent(
            signDownloadToken("backup", String(row.id), projectId),
          )}`
        : null,
  }));
  return NextResponse.json({ backups });
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "site.backups")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const plan = planLimits(ctx.current.team.planId);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const kind = body.kind === "safety" ? "safety" : "manual";
  const messages = body.messages === true;
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : null;

  const { count: manualCount } = await ctx.supabase
    .from("backups")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("kind", "manual");
  if (kind === "manual" && (manualCount ?? 0) >= plan.backupManualMax) {
    return NextResponse.json({ error: "BACKUP_LIMIT_REACHED" }, { status: 409 });
  }

  const { data: storageRows } = await ctx.supabase
    .from("backups")
    .select("media_bytes")
    .eq("project_id", projectId)
    .eq("status", "ready");
  const usedBytes = (storageRows ?? []).reduce(
    (sum, row) => sum + Number(row.media_bytes ?? 0),
    0,
  );
  if (usedBytes >= plan.backupStorageMb * 1024 * 1024) {
    return NextResponse.json({ error: "BACKUP_STORAGE_FULL" }, { status: 409 });
  }

  const { data: projectRow } = await ctx.supabase
    .from("projects")
    .select("id, name, subdomain, primary_host, settings")
    .eq("id", projectId)
    .maybeSingle();
  if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  try {
    const result = await createBackup(ctx.supabase, projectRow, {
      kind,
      messages,
      label,
      reason: kind === "safety" ? "before_change" : null,
      createdBy: ctx.current.user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return NextResponse.json({
      id: result.id,
      status: "ready",
      pageCount: result.pageCount,
      mediaCount: result.mediaCount,
      mediaBytes: result.mediaBytes,
      downloadUrl: `/api/downloads?token=${encodeURIComponent(
        signDownloadToken("backup", result.id, projectId),
      )}`,
    });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "BACKUP_FAILED";
    return NextResponse.json({ error: code }, { status: 500 });
  }
}
