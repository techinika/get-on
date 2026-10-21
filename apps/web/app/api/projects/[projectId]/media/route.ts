import { NextResponse } from "next/server";
import { requireProject } from "../pages/_lib";

type Params = { params: Promise<{ projectId: string }> };

const BUCKET = "project-media";
const ALLOWED = ["image/webp", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

function slug(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "picture"
  );
}

/** Upload a picture to the project media bucket. */
export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "UNSUPPORTED_FILE" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const width = Number(form?.get("width") ?? 0) || null;
  const height = Number(form?.get("height") ?? 0) || null;
  const name = `${projectId}/${crypto.randomUUID()}-${slug(file.name)}.${file.type.split("/")[1]}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await ctx.supabase.storage
    .from(BUCKET)
    .upload(name, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const { data: media, error: insertError } = await ctx.supabase
    .from("media")
    .insert({
      project_id: projectId,
      path: name,
      filename: file.name,
      mime: file.type,
      size_bytes: file.size,
      width,
      height,
      created_by: ctx.current.user.id,
    })
    .select("id, path, filename, mime, size_bytes, width, height, created_at")
    .single();

  if (insertError || !media) {
    await ctx.supabase.storage.from(BUCKET).remove([name]);
    return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
  }

  const { data: signed } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(name, 3600);
  return NextResponse.json({ media: { ...media, url: signed?.signedUrl ?? null } });
}

/** Delete a picture. Editors archive it, owners and admins remove it for good. */
export async function DELETE(request: Request, { params }: Params) {
  const { projectId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const ctx = guard.ctx;

  if (ctx.current.team.role === "viewer") {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 400 });
  }

  const { data: media } = await ctx.supabase
    .from("media")
    .select("id, path")
    .eq("id", id)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!media) {
    return NextResponse.json({ error: "UNKNOWN" }, { status: 404 });
  }

  if (ctx.current.team.role === "owner" || ctx.current.team.role === "admin") {
    await ctx.supabase.storage.from(BUCKET).remove([media.path]);
    const { error } = await ctx.supabase.from("media").delete().eq("id", media.id);
    if (error) {
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }
  } else {
    const { error } = await ctx.supabase
      .from("media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", media.id);
    if (error) {
      return NextResponse.json({ error: "UNKNOWN" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
