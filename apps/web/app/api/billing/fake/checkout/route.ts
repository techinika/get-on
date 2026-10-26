import { NextResponse } from "next/server";
import { completeFakePayment } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    (process.env.PAYMENT_PROVIDER ?? "fake").toLowerCase() === "pesapal"
  );
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function redirect(status: string): NextResponse {
  const target = new URL(
    "/dashboard/plan",
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  target.searchParams.set("payment", status);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  if (disabled()) return new NextResponse("Not found", { status: 404 });
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  if (!ref) return new NextResponse("Missing payment reference", { status: 400 });
  const safe = escape(ref);
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fake payment</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
  <h1 style="font-size:1.5rem">Fake payment</h1>
  <p>This page only exists in development. Payment reference: <code>${safe}</code></p>
  <form method="post" style="display:flex;gap:.75rem;flex-wrap:wrap">
    <input type="hidden" name="ref" value="${safe}">
    <button name="outcome" value="completed" style="padding:.75rem 1rem;font-size:1rem">Complete payment</button>
    <button name="outcome" value="failed" style="padding:.75rem 1rem;font-size:1rem">Fail payment</button>
    <button name="outcome" value="reversed" style="padding:.75rem 1rem;font-size:1rem">Reverse payment</button>
  </form>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (disabled()) return new NextResponse("Not found", { status: 404 });
  const form = await request.formData();
  const ref = String(form.get("ref") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  if (!ref || !["completed", "failed", "reversed"].includes(outcome)) {
    return new NextResponse("Bad request", { status: 400 });
  }
  try {
    await completeFakePayment({
      merchantReference: ref,
      outcome: outcome as "completed" | "failed" | "reversed",
    });
    return redirect(outcome === "completed" ? "success" : outcome);
  } catch {
    return redirect("error");
  }
}
