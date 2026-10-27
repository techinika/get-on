import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { putPackage } from "@/lib/site-package/storage";
import { MAX_CONTENT_BYTES, parseContentBytes, SitePackageError } from "@get-on/site-package";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });
  if (!can(current.team.role, "import.content")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const importId = new URL(request.url).searchParams.get("importId") ?? "";
  if (!importId) return NextResponse.json({ error: "IMPORT_NOT_VALID" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("project_imports")
    .select("id, project_id, team_id, status, expires_at")
    .eq("id", importId)
    .maybeSingle();
  if (!row || row.team_id !== current.team.teamId || !row.project_id) {
    return NextResponse.json({ error: "IMPORT_NOT_FOUND" }, { status: 404 });
  }
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "IMPORT_EXPIRED" }, { status: 410 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: "IMPORT_TOO_BIG" }, { status: 413 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: "IMPORT_TOO_BIG" }, { status: 413 });
  }

  let parsed: ReturnType<typeof parseContentBytes>;
  try {
    parsed = parseContentBytes(bytes);
  } catch (error) {
    const code = error instanceof SitePackageError ? error.code : "IMPORT_NOT_VALID";
    return NextResponse.json({ error: code }, { status: code === "IMPORT_TOO_BIG" ? 413 : 422 });
  }

  const key = `imports/${current.team.teamId}/${importId}.json`;
  try {
    await putPackage("imports", key, bytes, "application/json");
  } catch {
    return NextResponse.json({ error: "IMPORT_FAILED" }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const summary = {
    sourceName: parsed.manifest?.source.name ?? parsed.document.profile.name ?? "",
    sourceAddress: parsed.manifest?.source.address ?? parsed.document.profile.address ?? "",
    createdAt: parsed.manifest?.createdAt ?? null,
    pages: parsed.document.pages.length,
    pictures: parsed.manifest?.counts.pictures ?? 0,
    kind: parsed.manifest?.kind ?? "content",
  };
  const { error } = await admin
    .from("project_imports")
    .update({
      status: "validated",
      r2_key: key,
      bytes: bytes.byteLength,
      summary,
      warnings: [],
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", importId);
  if (error) return NextResponse.json({ error: "IMPORT_FAILED" }, { status: 500 });

  return NextResponse.json({
    importId,
    summary,
    warnings: [],
    expiresAt: expiresAt.toISOString(),
  });
}
