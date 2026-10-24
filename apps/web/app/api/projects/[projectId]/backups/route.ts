import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data } = await supabase
    .from("backups")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ backups: data ?? [] });
}

export async function POST() {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (current.team.role !== "owner" && current.team.role !== "admin" && current.team.role !== "editor") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    {
      error: "BACKUP_NOT_READY",
      message: "Backups are not switched on for this website yet.",
    },
    { status: 503 },
  );
}
