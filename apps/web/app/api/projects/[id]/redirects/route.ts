import { NextResponse } from "next/server";
import { getCurrentTeam } from "@/lib/team";

export async function GET() {
  return NextResponse.json({ redirects: [] });
}

export async function POST(req: Request) {
  const current = await getCurrentTeam();
  if (!current) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, redirect: body });
}
