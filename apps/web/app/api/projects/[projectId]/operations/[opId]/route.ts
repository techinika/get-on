import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";

type Params = { params: Promise<{ projectId: string; opId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId, opId } = await params;
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
    .from("project_operations")
    .select("*")
    .eq("id", opId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
