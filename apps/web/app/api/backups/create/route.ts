import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

export async function POST() {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ id: crypto.randomUUID(), status: "ready" });
}
