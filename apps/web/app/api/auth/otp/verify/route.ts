import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailOtpProvider } from "@/lib/auth/second-factor";
import { BINDING_COOKIE, DEVICE_COOKIE, PENDING_COOKIE } from "@/lib/auth/cookies";
import {
  hashDeviceId,
  markSessionVerified,
  sessionIdFromAccessToken,
  touchDevice,
} from "@/lib/auth/session-security";
import { getIpHash, safeNextPath, uaFamily } from "@/lib/security/request";
import { verifyToken } from "@/lib/security/tokens";
import { hashBrowserBinding } from "@/lib/security/otp";
import { tokenSecret } from "@/lib/security/tokens";
import { securityMessage } from "@/lib/security/messages";
import { recordSecurityEvent } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { enqueueEmail } from "@/lib/email/enqueue";
import { newDeviceEmail } from "@/lib/email/account-emails";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pending = verifyToken(cookieStore.get(PENDING_COOKIE)?.value);
  if (!pending || pending.purpose !== "login" || typeof pending.challengeId !== "string") {
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
  if (!user || !sessionId) {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: securityMessage("SESSION_EXPIRED") },
      { status: 401 },
    );
  }

  const limited = await rateLimit(`otp:verify:${sessionId}`, POLICIES.codeVerifyPerUser);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, code: "OTP_LOCKED", message: securityMessage("OTP_LOCKED"), retryAfter: limited.retryAfter },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = String(body.code ?? "");
  } catch {
    return NextResponse.json({ ok: false, code: "OTP_INVALID", message: securityMessage("OTP_INVALID") }, { status: 400 });
  }

  const ua = uaFamily(request.headers.get("user-agent"));
  const ipHash = getIpHash(request.headers);
  const binding = cookieStore.get(BINDING_COOKIE)?.value ?? "";
  const result = await emailOtpProvider.verify(String(pending.challengeId), code, {
    browserBindingHash: binding ? hashBrowserBinding(binding, tokenSecret()) : null,
    sessionId,
    userId: user.id,
    ipHash,
    uaFamily: ua,
  });

  if (!result.ok) {
    await recordSecurityEvent({
      userId: user.id,
      category: "second_factor",
      event: result.code === "OTP_EXPIRED" ? "otp_expired" : "otp_failed",
      severity: "notice",
      summary: result.code === "OTP_EXPIRED" ? "Sign-in code expired" : "Wrong sign-in code",
      ipHash,
      uaFamily: ua,
      visibleToUser: true,
    });
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: securityMessage(result.code),
        remaining: result.remaining ?? null,
      },
      { status: 400 },
    );
  }

  if (result.userId !== user.id || result.sessionId !== sessionId) {
    return NextResponse.json({ ok: false, code: "TOKEN_INVALID", message: securityMessage("TOKEN_INVALID") }, { status: 400 });
  }

  await markSessionVerified({ sessionId, userId: user.id, challengeId: String(pending.challengeId) });

  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (deviceId) {
    const deviceHash = hashDeviceId(deviceId);
    const { isNew } = await touchDevice({ userId: user.id, deviceIdHash: deviceHash, label: ua });
    if (isNew) {
      const email = user.email ?? "";
      const notice = newDeviceEmail({
        device: ua,
        when: `${new Date().toISOString().slice(0, 10)} ${new Date().toISOString().slice(11, 16)} UTC`,
        country: null,
      });
      await enqueueEmail({
        kind: "new_device_sign_in",
        stream: "transactional",
        userId: user.id,
        toEmail: email,
        relatedType: "session",
        relatedId: sessionId,
        dedupeKey: `newdevice:${sessionId}`,
        payload: { subject: notice.subject, text: notice.text, html: notice.html },
      });
    }
  }

  await recordSecurityEvent({
    userId: user.id,
    category: "auth",
    event: "login_succeeded",
    severity: "info",
    summary: `Signed in from ${ua}`,
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
  });

  const response = NextResponse.json({ ok: true, next: safeNextPath(pending.next, "/dashboard") });
  response.cookies.delete(PENDING_COOKIE);
  response.cookies.delete(BINDING_COOKIE);
  return response;
}
