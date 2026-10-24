import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeam } from "@/lib/team";
import { invalidateQuickFind } from "@/lib/project-activity";

type Params = { params: Promise<{ projectId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const current = await getCurrentTeam();
  if (!current) {
    return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 401 });
  }
  if (current.team.role === "viewer") {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }

  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("team_id", current.team.teamId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  try {
    // Try soft delete if column exists
    const { error } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("team_id", current.team.teamId);
    if (error) {
      // Fallback to hard delete if no soft delete column
      const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId);
      if (deleteError) {
        return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
      }
    }
    invalidateQuickFind(current.team.teamId);
    return NextResponse.json({ ok: true });
  } catch {
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId);
    if (deleteError) {
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }
    invalidateQuickFind(current.team.teamId);
    return NextResponse.json({ ok: true });
  }
}
