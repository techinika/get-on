import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

type Params = { params: Promise<{ projectId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (current.team.role !== "owner" && current.team.role !== "admin" && current.team.role !== "editor") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
