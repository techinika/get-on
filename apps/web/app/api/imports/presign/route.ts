import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

export async function POST() {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (current.team.role !== "owner" && current.team.role !== "admin" && current.team.role !== "editor") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
