import { NextResponse } from "next/server";
import { handleProviderStatus } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function planRedirect(status: string): NextResponse {
  const target = new URL("/dashboard/plan", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  target.searchParams.set("payment", status);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderTrackingId = url.searchParams.get("OrderTrackingId") ?? "";
  if (!orderTrackingId) return planRedirect("cancelled");

  try {
    const result = await handleProviderStatus(orderTrackingId);
    const status = String(result.status ?? "");
    if (status === "confirmed" || status === "duplicate") return planRedirect("success");
    if (status === "review") return planRedirect("review");
    return planRedirect("failed");
  } catch {
    return planRedirect("error");
  }
}
