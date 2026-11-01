import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPendingSignup } from "@/lib/auth/pending";
import { BINDING_COOKIE, DEVICE_COOKIE, PENDING_COOKIE, deviceCookieOptions } from "@/lib/auth/cookies";
import {
  createPendingSession,
  hashDeviceId,
  markSessionVerified,
  sessionIdFromAccessToken,
  touchDevice,
} from "@/lib/auth/session-security";
import { getIpHash, uaFamily } from "@/lib/security/request";
import { securityMessage } from "@/lib/security/messages";
import { recordSecurityEvent } from "@/lib/security/events";
import { rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { enqueueEmail } from "@/lib/email/enqueue";
import { welcomeEmail } from "@/lib/email/account-emails";
import { newBindingValue } from "@/lib/security/otp";
import { grantFreeEntitlements } from "@/lib/provisioning";

export const dynamic = "force-dynamic";

function rejected(code: string, status = 400) {
  return NextResponse.json(
    { ok: false, code, message: securityMessage(code) },
    { status },
  );
}

export async function POST(request: Request) {
  const pending = await readPendingSignup();
  if (!pending) return rejected("SESSION_EXPIRED");

  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = String(body.code ?? "").replace(/\D/g, "");
  } catch {
    return rejected("OTP_INVALID");
  }
  if (code.length !== 6) return rejected("OTP_INVALID");

  const ipHash = getIpHash(request.headers);
  const ua = uaFamily(request.headers.get("user-agent"));
  const emailHash = createHash("sha256").update(pending.email).digest("hex");

  const limited = await rateLimit(`signup:verify:${emailHash}`, POLICIES.codeVerifyPerUser);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, code: "OTP_LOCKED", message: securityMessage("OTP_LOCKED"), retryAfter: limited.retryAfter },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const response = NextResponse.json({ ok: true, next: "/mfa/setup" });
  const supabase = await createRouteClient(response);
  const { data, error } = await supabase.auth.verifyOtp({
    email: pending.email,
    token: code,
    type: "signup",
  });

  if (error || !data.user || !data.session) {
    const expired = /expired/i.test(error?.message ?? "");
    await recordSecurityEvent({
      category: "account",
      event: expired ? "signup_code_expired" : "signup_code_failed",
      severity: "notice",
      summary: expired ? "A signup code expired" : "A wrong signup code was entered",
      ipHash,
      uaFamily: ua,
      visibleToUser: true,
    });
    return rejected(expired ? "OTP_EXPIRED" : "OTP_INVALID");
  }

  const userId = data.user.id;
  const sessionId = sessionIdFromAccessToken(data.session.access_token);
  if (!sessionId) return rejected("SOMETHING_WRONG", 500);

  const admin = createAdminClient();
  const verifiedAt = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ email_verified_at: verifiedAt, last_sign_in_at: verifiedAt })
    .eq("id", userId);

  const cookieStore = await cookies();
  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newBindingValue();
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  }
  const deviceHash = hashDeviceId(deviceId);

  try {
    await createPendingSession({ sessionId, userId, ipHash, uaFamily: ua, deviceIdHash: deviceHash });
    await markSessionVerified({ sessionId, userId, method: "signup_otp", challengeId: null });
  } catch (error) {
    console.error("Could not finish signup verification", error);
    return rejected("SOMETHING_WRONG", 500);
  }
  await touchDevice({ userId, deviceIdHash: deviceHash, label: ua });

  const welcome = welcomeEmail(null);
  await enqueueEmail({
    kind: "welcome",
    stream: "transactional",
    userId,
    toEmail: pending.email,
    relatedType: "account",
    relatedId: userId,
    dedupeKey: `welcome:${userId}`,
    payload: { subject: welcome.subject, text: welcome.text, html: welcome.html },
  });

  await grantFreeEntitlements(userId);

  await recordSecurityEvent({
    userId,
    category: "auth",
    event: "email_verified",
    severity: "info",
    summary: "Email confirmed and account opened",
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
  });

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp ?? []).some((factor) => factor.status === "verified");
  const target = new URL(hasTotp ? "/mfa" : "/mfa/setup", request.url);
  if (pending.next !== "/dashboard") target.searchParams.set("next", pending.next);

  const finalResponse = NextResponse.json({ ok: true, next: `${target.pathname}${target.search}` });
  for (const cookie of response.cookies.getAll()) finalResponse.cookies.set(cookie);
  finalResponse.cookies.delete(BINDING_COOKIE);
  finalResponse.cookies.delete(PENDING_COOKIE);
  return finalResponse;
}
