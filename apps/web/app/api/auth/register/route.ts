import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { registerAccount } from "@/lib/auth/register";
import { BINDING_COOKIE, PENDING_COOKIE, pendingCookieOptions } from "@/lib/auth/cookies";
import { getIpHash, isSameOrigin, uaFamily } from "@/lib/security/request";
import { securityMessage } from "@/lib/security/messages";
import { signToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

const MIN_RESPONSE_MS = 250;

function jitter() {
  return 200 + Math.floor(Math.random() * 200);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return (await request.json()) as Record<string, unknown>;
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(request: Request) {
  const started = Date.now();
  const sleep = async () => {
    const target = MIN_RESPONSE_MS + jitter();
    const remaining = target - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  };

  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    await sleep();
    return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: securityMessage("RATE_LIMITED") }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBody(request);
  } catch {
    await sleep();
    return NextResponse.json(
      { ok: false, code: "SOMETHING_WRONG", message: securityMessage("SOMETHING_WRONG") },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const result = await registerAccount({
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    fullName: String(body.fullName ?? "").trim().slice(0, 80),
    termsAccepted: body.termsAccepted === true || body.termsAccepted === "true" || body.termsAccepted === "on",
    marketingOptIn: body.marketingOptIn === true || body.marketingOptIn === "on",
    timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 60) : null,
    ipHash: getIpHash(request.headers),
    uaFamily: uaFamily(request.headers.get("user-agent")),
    turnstileToken: typeof body.turnstileToken === "string" ? body.turnstileToken : null,
    referralCode: cookieStore.get("gs_ref")?.value ?? null,
  });

  await sleep();

  if (result.ok) {
    const pending = signToken(
      { email: result.email, purpose: "signup_verify", next: "/dashboard/new" },
      30 * 60,
    );
    const response = NextResponse.json({ ok: true, next: "/verify-email", maskedEmail: result.maskedEmail });
    response.cookies.delete(BINDING_COOKIE);
    response.cookies.set(PENDING_COOKIE, pending.value, pendingCookieOptions());
    return response;
  }

  if (result.pending) {
    const pending = signToken(
      { email: result.pending.email, purpose: "signup_verify", next: "/dashboard/new" },
      30 * 60,
    );
    const response = NextResponse.json({
      ok: false,
      code: result.code,
      message: securityMessage("AUTH_EMAIL_EXISTS_UNVERIFIED"),
      field: "email",
      next: "/verify-email",
    });
    response.cookies.delete(BINDING_COOKIE);
    response.cookies.set(PENDING_COOKIE, pending.value, pendingCookieOptions());
    return response;
  }

  const status = result.code === "RATE_LIMITED" ? 429 : result.code === "SOMETHING_WRONG" ? 500 : 400;
  return NextResponse.json(
    {
      ok: false,
      code: result.code,
      message: securityMessage(result.code),
      field: result.field,
      passwordErrors: result.passwordErrors ?? [],
      retryAfter: result.retryAfter ?? 0,
    },
    { status, headers: result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined },
  );
}

export function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
