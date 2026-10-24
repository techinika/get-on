import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";
import { saveRedirect } from "@/app/dashboard/(shell)/projects/[projectId]/settings/actions";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { data } = await guard.ctx.supabase
    .from("redirects")
    .select("id, from_path, to_type, to_value, code, hits, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ redirects: data ?? [] });
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const body = await req.json().catch(() => ({}));
  const formData = new FormData();
  formData.set("from", String((body as { from?: unknown }).from ?? ""));
  formData.set("to", String((body as { to?: unknown }).to ?? ""));
  const result = await saveRedirect(projectId, formData);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
