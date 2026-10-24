import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

export async function POST(req: Request) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (current.team.role === "viewer") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = body.name || "upload.getonsite";
  const size = body.size || 0;
  return NextResponse.json({ uploadUrl: "/api/imports/upload", importId: crypto.randomUUID(), name, size });
}
