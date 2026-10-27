import { NextResponse } from "next/server";
import { requireProject } from "../../../pages/_lib";
import { can } from "@/lib/permissions";
import { shortLinkFor } from "@/lib/links/service";
import { qrPdf, qrPng, qrSvg } from "@/lib/links/qr";
import { createPublishStore } from "@/lib/publishing/store";
import { primaryAddress, readPublishConfig, siteHostname } from "@/lib/publishing/config";

type Params = { params: Promise<{ projectId: string; linkId: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, { params }: Params) {
  const { projectId, linkId } = await params;
  const guard = await requireProject(projectId);
  if (!guard.ok) return guard.response;
  const { ctx } = guard;
  if (!can(ctx.current.team.role, "links.view")) {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  const { data: link } = await ctx.supabase
    .from("tracked_links")
    .select("id, code, target_path, revoked_at")
    .eq("id", linkId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "LINK_NOT_FOUND" }, { status: 404 });
  if (link.revoked_at) return NextResponse.json({ error: "LINK_INACTIVE" }, { status: 409 });

  const config = readPublishConfig();
  const pointer = await createPublishStore(config).getPointer(
    siteHostname(config, ctx.project.subdomain),
  );
  if (!pointer || pointer.state !== "live") {
    return NextResponse.json({ error: "NOT_PUBLISHED" }, { status: 409 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "png";
  if (format !== "png" && format !== "svg" && format !== "pdf") {
    return NextResponse.json({ error: "QR_FORMAT_INVALID" }, { status: 400 });
  }
  const url = shortLinkFor(ctx.project, String(link.code));
  const base = ctx.project.subdomain.replace(/[^a-z0-9-]/gi, "-");

  if (format === "svg") {
    const svg = await qrSvg(url);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}-qr.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "png") {
    const png = await qrPng(url);
    return new NextResponse(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${base}-qr.png"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = await qrPdf({
    url,
    businessName: ctx.project.name,
    address: primaryAddress(config, ctx.project.subdomain, ctx.project.primary_host),
  });
  return new NextResponse(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}-qr.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
