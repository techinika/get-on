import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailOtpProvider } from "@/lib/auth/second-factor";
import { BINDING_COOKIE, PENDING_COOKIE, DEVICE_COOKIE, deviceCookieOptions } from "@/lib/auth/cookies";
import {
  createPendingSession,
  hashDeviceId,
  markSessionVerified,
  sessionIdFromAccessToken,
  touchDevice,
} from "@/lib/auth/session-security";
import { getIpHash, uaFamily } from "@/lib/security/request";
import { verifyToken } from "@/lib/security/tokens";
import { securityMessage } from "@/lib/security/messages";
import { recordSecurityEvent } from "@/lib/security/events";
import { enqueueEmail } from "@/lib/email/enqueue";
import { welcomeEmail } from "@/lib/email/account-emails";
import { newBindingValue, hashBrowserBinding } from "@/lib/security/otp";
import { tokenSecret } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const pending = verifyToken(cookieStore.get(PENDING_COOKIE)?.value);
  const binding = cookieStore.get(BINDING_COOKIE)?.value ?? "";

  if (!pending || pending.purpose !== "signup_verify" || typeof pending.challengeId !== "string") {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: securityMessage("SESSION_EXPIRED") },
      { status: 400 },
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
  const result = await emailOtpProvider.verify(String(pending.challengeId), code, {
    browserBindingHash: binding ? hashBrowserBinding(binding, tokenSecret()) : null,
    ipHash,
    uaFamily: ua,
  });

  if (!result.ok) {
    if (result.code === "OTP_EXPIRED") {
      await recordSecurityEvent({
        userId: null,
        category: "second_factor",
        event: "otp_expired",
        severity: "notice",
        summary: "A verification code expired",
        ipHash,
        uaFamily: ua,
        visibleToUser: true,
      });
    }
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

  if (!result.userId) {
    return NextResponse.json({ ok: false, code: "TOKEN_INVALID", message: securityMessage("TOKEN_INVALID") }, { status: 400 });
  }

  const admin = createAdminClient();
  const confirmed = await admin.auth.admin.updateUserById(result.userId, { email_confirm: true });
  if (confirmed.error) {
    console.error("[security] could not confirm email:", confirmed.error.message);
    return NextResponse.json(
      { ok: false, code: "SOMETHING_WRONG", message: securityMessage("SOMETHING_WRONG") },
      { status: 500 },
    );
  }

  const verifiedAt = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ email_verified_at: verifiedAt, last_sign_in_at: verifiedAt })
    .eq("id", result.userId);

  // Start the session server-side. The email code we just accepted counts as
  // the first sign-in code for this device.
  const response = NextResponse.json({ ok: true, next: "/dashboard/new" });
  const supabase = await createRouteClient(response);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: result.email });
  const hashedToken = link.data?.properties?.hashed_token;
  if (link.error || !hashedToken) {
    console.error("[security] could not start session:", link.error?.message);
    return NextResponse.json(
      { ok: false, code: "SOMETHING_WRONG", message: securityMessage("SOMETHING_WRONG") },
      { status: 500 },
    );
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  if (sessionError || !sessionData.session) {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: securityMessage("SESSION_EXPIRED") },
      { status: 400 },
    );
  }

  const sessionId = sessionIdFromAccessToken(sessionData.session.access_token);
  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newBindingValue();
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  }
  const deviceHash = hashDeviceId(deviceId);

  if (sessionId) {
    await createPendingSession({ sessionId, userId: result.userId, ipHash, uaFamily: ua, deviceIdHash: deviceHash });
    await markSessionVerified({ sessionId, userId: result.userId, challengeId: String(pending.challengeId) });
  }
  await touchDevice({ userId: result.userId, deviceIdHash: deviceHash, label: ua });

  const welcome = welcomeEmail(null);
  await enqueueEmail({
    kind: "welcome",
    stream: "transactional",
    userId: result.userId,
    toEmail: result.email,
    relatedType: "account",
    relatedId: result.userId,
    dedupeKey: `welcome:${result.userId}`,
    payload: { subject: welcome.subject, text: welcome.text, html: welcome.html },
  });

  await recordSecurityEvent({
    userId: result.userId,
    category: "auth",
    event: "email_verified",
    severity: "info",
    summary: "Email confirmed and account opened",
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
  });

  response.cookies.delete(BINDING_COOKIE);
  response.cookies.delete(PENDING_COOKIE);
  return response;
}
