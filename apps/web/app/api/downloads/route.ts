import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTeam } from "@/lib/team";
import { can } from "@/lib/permissions";
import { readPackage } from "@/lib/site-package/storage";
import { verifyDownloadToken } from "@/lib/site-package/token";

export const runtime = "nodejs";

function disposition(name: string): string {
  return `attachment; filename="${name.replace(/["\r\n]/g, "-")}"`;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const payload = verifyDownloadToken(token);
  if (!payload) return NextResponse.json({ error: "DOWNLOAD_NOT_FOUND" }, { status: 404 });

  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, team_id, name, subdomain")
    .eq("id", payload.projectId)
    .maybeSingle();
  if (!project || project.team_id !== current.team.teamId) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  if (payload.kind === "export") {
    const { data: row } = await admin
      .from("project_exports")
      .select("id, kind, status, r2_key, file_name, mime, expires_at, project_id, download_count")
      .eq("id", payload.id)
      .eq("project_id", payload.projectId)
      .maybeSingle();
    if (!row || row.status !== "ready" || !row.r2_key) {
      return NextResponse.json({ error: "DOWNLOAD_NOT_FOUND" }, { status: 404 });
    }
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "DOWNLOAD_EXPIRED" }, { status: 410 });
    }
    const action =
      row.kind === "site_zip"
        ? "export.site_zip"
        : row.kind === "backup"
          ? "export.backup"
          : "export.content";
    if (!can(current.team.role, action)) {
      return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
    }
    let bytes: Uint8Array;
    try {
      bytes = await readPackage("exports", row.r2_key);
    } catch {
      return NextResponse.json({ error: "DOWNLOAD_NOT_FOUND" }, { status: 404 });
    }
    await admin
      .from("project_exports")
      .update({ download_count: (row.download_count ?? 0) + 1 })
      .eq("id", row.id);
    return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": row.mime ?? "application/octet-stream",
        "Content-Disposition": disposition(row.file_name ?? "download"),
        "Cache-Control": "no-store",
        "Content-Length": String(bytes.byteLength),
      },
    });
  }

  const { data: row } = await admin
    .from("backups")
    .select("id, status, r2_key, label, created_at, expires_at, project_id")
    .eq("id", payload.id)
    .eq("project_id", payload.projectId)
    .maybeSingle();
  if (!row || row.status !== "ready" || !row.r2_key) {
    return NextResponse.json({ error: "BACKUP_NOT_FOUND" }, { status: 404 });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "DOWNLOAD_EXPIRED" }, { status: 410 });
  }
  if (!can(current.team.role, "export.backup")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  let bytes: Uint8Array;
  try {
    bytes = await readPackage("backups", row.r2_key);
  } catch {
    return NextResponse.json({ error: "BACKUP_NOT_FOUND" }, { status: 404 });
  }
  return new NextResponse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposition(`${project.subdomain}-backup.zip`),
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
