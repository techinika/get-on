import { NextResponse } from "next/server";
import { getInvoice } from "@/lib/billing/service";
import { invoicePdf } from "@/lib/billing/pdf";
import { getShellData } from "@/lib/dashboard";
import { can } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const data = await getShellData();
  if (!data) return new NextResponse("Not found", { status: 404 });
  if (!can(data.currentTeam.role, "billing.invoices")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { invoiceId } = await params;
  const result = await getInvoice(data.currentTeam.id, invoiceId);
  if (!result) return new NextResponse("Not found", { status: 404 });

  const bytes = invoicePdf({
    invoice: result.raw as Record<string, unknown>,
    lines: result.lines as Array<Record<string, unknown>>,
    teamName: data.currentTeam.name,
  });
  const number = String((result.raw as Record<string, unknown>).number ?? "invoice");
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${number.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
