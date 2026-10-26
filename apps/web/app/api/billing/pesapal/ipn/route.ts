import { NextResponse } from "next/server";
import { handleProviderStatus } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readPayload(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  return Object.fromEntries(form.entries());
}

function value(payload: Record<string, unknown>, key: string): string {
  const found = payload[key] ?? payload[key.toLowerCase()];
  return typeof found === "string" ? found : "";
}

export async function POST(request: Request) {
  const payload = await readPayload(request);
  const orderTrackingId = value(payload, "OrderTrackingId");
  const merchantReference = value(payload, "OrderMerchantReference");
  const notificationType = value(payload, "OrderNotificationType") || "IPNCHANGE";

  if (!orderTrackingId) {
    return NextResponse.json(
      { status: 400, message: "Missing OrderTrackingId" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await handleProviderStatus(orderTrackingId);
    return NextResponse.json(
      {
        orderNotificationType: notificationType,
        orderTrackingId,
        orderMerchantReference: merchantReference,
        status: 200,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: 500, message: "Could not process notification" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
