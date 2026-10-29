import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { emailOtpProvider } from "@/lib/auth/second-factor";
import { BINDING_COOKIE, PENDING_COOKIE, pendingCookieOptions } from "@/lib/auth/cookies";
import { sessionIdFromAccessToken } from "@/lib/auth/session-security";
import { getIpHash, uaFamily } from "@/lib/security/request";
import { hashBrowserBinding } from "@/lib/security/otp";
import { signToken, tokenSecret, verifyToken } from "@/lib/security/tokens";
import { securityMessage } from "@/lib/security/messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pending = verifyToken(cookieStore.get(PENDING_COOKIE)?.value);
  if (!pending || typeof pending.challengeId !== "string" || !pending.purpose) {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: securityMessage("SESSION_EXPIRED") },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionId = sessionIdFromAccessToken(sessionData.session?.access_token);

  const binding = cookieStore.get(BINDING_COOKIE)?.value ?? "";
  const result = await emailOtpProvider.resend(String(pending.challengeId), {
    userId: user?.id ?? null,
    sessionId,
    browserBindingHash: binding ? hashBrowserBinding(binding, tokenSecret()) : null,
    ipHash: getIpHash(request.headers),
    uaFamily: uaFamily(request.headers.get("user-agent")),
  });

  if (!("challengeId" in result)) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: securityMessage(result.code),
        retryAfter: result.retryAfter ?? 60,
      },
      { status: 429, headers: { "Retry-After": String(result.retryAfter ?? 60) } },
    );
  }

  const refreshed = signToken(
    { challengeId: result.challengeId, purpose: pending.purpose, next: pending.next ?? "/dashboard" },
    30 * 60,
  );
  cookieStore.set(PENDING_COOKIE, refreshed.value, pendingCookieOptions());

  return NextResponse.json({ ok: true, maskedEmail: result.maskedEmail, challengeId: result.challengeId });
}
