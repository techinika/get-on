import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { can } from "@/lib/permissions";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const data = await getShellData();
  if (!data) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(data.currentTeam.role as "owner" | "admin" | "editor" | "viewer", "team.activity")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("team_activity")
    .select("occurred_at, actor_name, actor_role, category, event, summary, project_name, count")
    .eq("team_id", data.currentTeam.id)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  const category = params.get("category");
  const categories: Record<string, string[]> = {
    website: ["website"], page: ["page"], design: ["design"], pictures: ["pictures"],
    settings: ["settings"], domain: ["domain"], plugin: ["plugin"], template: ["template"],
    backup: ["backup"], ai: ["ai"], people: ["member", "invitation", "team", "referral"], security: ["security"],
  };
  if (category && categories[category]) query = query.in("category", categories[category]!);
  const project = params.get("project");
  if (project) query = query.eq("project_id", project);
  const actor = params.get("actor");
  if (actor === "system") query = query.neq("actor_kind", "user");
  else if (actor) query = query.eq("actor_user_id", actor);
  const range = params.get("range");
  if (range === "7" || range === "30" || range === "90") {
    query = query.gte("occurred_at", new Date(Date.now() - Number(range) * 864e5).toISOString());
  }
  const q = params.get("q");
  if (q) query = query.ilike("summary", `%${q.slice(0, 80)}%`);

  const { data: rows, error } = await query;
  if (error) return new NextResponse("Could not export activity", { status: 500 });

  const header = ["When", "Who", "Role", "Category", "Event", "What happened", "Website", "Times"];
  const lines = [
    header.map(csvCell).join(","),
    ...(rows ?? []).map((row) =>
      [
        row.occurred_at, row.actor_name, row.actor_role, row.category, row.event,
        row.summary, row.project_name, row.count,
      ].map(csvCell).join(","),
    ),
  ];
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="team-activity.csv"`,
    },
  });
}
