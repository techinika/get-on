import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string; opId: string }> }) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await params;
  return NextResponse.json({ status: "done" });
}
