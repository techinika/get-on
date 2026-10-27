import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { can } from "@/lib/permissions";
import { planLimits } from "@/lib/plans";
import {
  buildBackup,
  buildContentBytes,
  buildWebsiteZip,
  loadPackageSource,
} from "@/lib/site-package/content";
import { putPackage } from "@/lib/site-package/storage";
import { signDownloadToken } from "@/lib/site-package/token";
import { sha256Hex } from "@get-on/site-package";

type Params = { params: Promise<{ projectId: string }> };

export const runtime = "nodejs";

type ExportKind = "content" | "backup" | "site_zip";

function kindOf(value: unknown): ExportKind | null {
  return value === "content" || value === "backup" || value === "site_zip" ? value : null;
}

function startOfToday(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function expiresFor(kind: ExportKind): Date {
  const date = new Date();
  date.setTime(date.getTime() + (kind === "site_zip" ? 24 : 7 * 24) * 60 * 60 * 1000);
  return date;
}

function fileNameFor(kind: ExportKind, subdomain: string): string {
  const safe = subdomain.replace(/[^a-z0-9-]/gi, "-");
  if (kind === "content") return `${safe}-website.json`;
  if (kind === "backup") return `${safe}-backup.zip`;
  return `${safe}-website-files.zip`;
}

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "export.content")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const { data } = await ctx.supabase
    .from("project_exports")
    .select("id, kind, status, bytes, file_name, mime, expires_at, created_at, download_count")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ exports: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  const role = ctx.current.team.role;
  const plan = planLimits(ctx.current.team.planId);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const kind = kindOf((body as { kind?: unknown } | null)?.kind ?? "content");
  if (!kind) return NextResponse.json({ error: "EXPORT_INVALID" }, { status: 400 });

  if (kind === "content" && !can(role, "export.content")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  if (kind === "backup" && !can(role, "export.backup")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  if (kind === "site_zip") {
    if (!can(role, "export.site_zip")) {
      return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
    }
    if (!plan.siteZipAllowed) {
      return NextResponse.json({ error: "SITE_ZIP_NOT_INCLUDED" }, { status: 403 });
    }
  }

  const dailyLimit = kind === "site_zip" ? plan.siteZipPerDay : plan.exportsPerDay;
  const { count } = await ctx.supabase
    .from("project_exports")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("created_at", startOfToday())
    .in("kind", kind === "site_zip" ? ["site_zip"] : ["content", "backup"]);
  if ((count ?? 0) >= dailyLimit) {
    return NextResponse.json({ error: "EXPORT_LIMIT_REACHED" }, { status: 429 });
  }

  const { data: projectRow } = await ctx.supabase
    .from("projects")
    .select("id, name, subdomain, primary_host, settings")
    .eq("id", projectId)
    .maybeSingle();
  if (!projectRow) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  const source = await loadPackageSource(ctx.supabase, projectRow);
  let bytes: Uint8Array;
  let contentType: string;
  try {
    if (kind === "content") {
      bytes = buildContentBytes(source).bytes;
      contentType = "application/json";
    } else if (kind === "backup") {
      const backup = await buildBackup(ctx.supabase, source, {
        pictures: true,
        files: true,
        messages: false,
      });
      bytes = backup.bytes;
      contentType = "application/zip";
    } else {
      const website = await buildWebsiteZip(ctx.supabase, source, ctx.current.team.planId);
      bytes = website.bytes;
      contentType = "application/zip";
    }
  } catch (error) {
    const code = (error as { code?: string }).code ?? "EXPORT_FAILED";
    return NextResponse.json({ error: code }, { status: code === "EXPORT_NOT_VALID" ? 422 : 500 });
  }

  const id = crypto.randomUUID();
  const key = `exports/${projectId}/${id}.${kind === "content" ? "json" : "zip"}`;
  const fileName = fileNameFor(kind, source.project.subdomain);
  const expiresAt = expiresFor(kind);

  try {
    await putPackage("exports", key, bytes, contentType);
  } catch {
    return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }

  const { error } = await ctx.supabase.from("project_exports").insert({
    id,
    project_id: projectId,
    kind,
    status: "ready",
    version_source: "draft",
    r2_key: key,
    bytes: bytes.byteLength,
    file_name: fileName,
    mime: contentType,
    sha256: sha256Hex(bytes),
    format_version: 1,
    expires_at: expiresAt.toISOString(),
    created_by: ctx.current.user.id,
    options: {},
  });
  if (error) {
    return NextResponse.json({ error: "EXPORT_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    id,
    kind,
    bytes: bytes.byteLength,
    fileName,
    expiresAt: expiresAt.toISOString(),
    downloadUrl: `/api/downloads?token=${encodeURIComponent(
      signDownloadToken("export", id, projectId),
    )}`,
  });
}
