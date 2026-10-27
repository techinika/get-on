import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });
  if (!can(current.team.role, "import.content")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const name = typeof body.name === "string" ? body.name : "website.json";
  const size = Number(body.size ?? 0);
  if (!projectId || !name.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ error: "IMPORT_NOT_VALID" }, { status: 400 });
  }
  if (size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "IMPORT_TOO_BIG" }, { status: 413 });
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, team_id")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });

  const id = crypto.randomUUID();
  const { error } = await admin.from("project_imports").insert({
    id,
    project_id: projectId,
    team_id: current.team.teamId,
    status: "uploaded",
    bytes: 0,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    created_by: current.user.id,
    summary: { name },
  });
  if (error) return NextResponse.json({ error: "IMPORT_FAILED" }, { status: 500 });
  return NextResponse.json({
    importId: id,
    uploadUrl: `/api/imports/upload?importId=${encodeURIComponent(id)}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}
