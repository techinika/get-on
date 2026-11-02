import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEVICE_COOKIE, deviceCookieOptions } from "@/lib/auth/cookies";
import {
  createPendingSession,
  hashDeviceId,
  sessionIdFromAccessToken,
  syncProfileConfirmation,
} from "@/lib/auth/session-security";
import { getIpHash, isSameOrigin, safeNextPath, uaFamily } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { peekRateLimit, rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { newBindingValue } from "@/lib/security/otp";
import { recordSecurityEvent } from "@/lib/security/events";
import { getSecuritySettings } from "@/lib/security/settings";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/** Same text and shape for unknown accounts and wrong passwords. */
function loginFailed(request: Request, code: string, next: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  if (next && next !== "/dashboard") url.searchParams.set("next", next);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.redirect(new URL("/login?error=RATE_LIMITED", request.url), 303);
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(form.get("next"), "/dashboard");
  const turnstileToken = typeof form.get("cf-turnstile-response") === "string" ? String(form.get("cf-turnstile-response")) : null;

  const ua = uaFamily(request.headers.get("user-agent"));
  const ipHash = getIpHash(request.headers);
  const emailHash = createHash("sha256").update(email).digest("hex");
  const settings = await getSecuritySettings();

  const failureKey = `login:fail:email:${emailHash}`;
  const priorFailures = await peekRateLimit(failureKey);
  if (priorFailures >= 3) {
    const turnstile = await verifyTurnstile(turnstileToken, { action: "login" });
    if (!turnstile.ok) return loginFailed(request, "TURNSTILE_FAILED", next);
  }

  const [perEmail, perIp] = await Promise.all([
    rateLimit(`login:email:${emailHash}`, POLICIES.loginPerEmail),
    rateLimit(`login:ip:${ipHash}`, POLICIES.loginPerIp),
  ]);
  if (!perEmail.ok || !perIp.ok) {
    await recordSecurityEvent({
      category: "auth",
      event: "login_rate_limited",
      severity: "warning",
      summary: "Too many sign-in attempts",
      ipHash,
      uaFamily: ua,
      visibleToUser: false,
    });
    return loginFailed(request, "AUTH_LOCKED", next);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,locked_until")
    .eq("email_canonical", email)
    .is("duplicate_of", null)
    .maybeSingle();
  if (profile?.locked_until && new Date(String(profile.locked_until)).getTime() > Date.now()) {
    return loginFailed(request, "AUTH_LOCKED", next);
  }

  const response = NextResponse.redirect(new URL("/mfa", request.url), 303);
  const supabase = await createRouteClient(response);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    await rateLimit(failureKey, POLICIES.loginPerEmail);
    const failures = await peekRateLimit(failureKey);
    if (failures >= settings.maxLoginFailures) {
      await rateLimit(`login:lock:${emailHash}`, { limit: 1, windowSeconds: settings.lockoutMinutes * 60 });
      if (profile?.id) {
        await admin
          .from("profiles")
          .update({ locked_until: new Date(Date.now() + settings.lockoutMinutes * 60_000).toISOString() })
          .eq("id", String(profile.id));
        await recordSecurityEvent({
          userId: String(profile.id),
          category: "auth",
          event: "account_locked",
          severity: "warning",
          summary: "Account locked after too many password attempts",
          ipHash,
          uaFamily: ua,
          visibleToUser: true,
        });
      }
      return loginFailed(request, "AUTH_LOCKED", next);
    }
    await recordSecurityEvent({
      userId: profile?.id ? String(profile.id) : null,
      category: "auth",
      event: "login_failed",
      severity: "notice",
      summary: "Wrong password",
      ipHash,
      uaFamily: ua,
      visibleToUser: Boolean(profile?.id),
    });
    return loginFailed(request, "AUTH_INVALID_CREDENTIALS", next);
  }

  const userId = data.user.id;
  const sessionId = sessionIdFromAccessToken(data.session.access_token);
  if (!sessionId) {
    return loginFailed(request, "SOMETHING_WRONG", next);
  }

  try {
    await syncProfileConfirmation({
      userId,
      emailConfirmedAt: data.user.email_confirmed_at,
    });
  } catch (error) {
    console.error("Could not sync the profile email confirmation", error);
    return loginFailed(request, "SOMETHING_WRONG", next);
  }

  const cookieStore = await cookies();

  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newBindingValue();
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  }
  const deviceHash = hashDeviceId(deviceId);

  try {
    await createPendingSession({ sessionId, userId, ipHash, uaFamily: ua, deviceIdHash: deviceHash });
  } catch (error) {
    console.error("Could not start the sign-in session", error);
    return loginFailed(request, "SOMETHING_WRONG", next);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp ?? []).some((factor) => factor.status === "verified");
  const target = new URL(hasTotp ? "/mfa" : "/mfa/setup", request.url);
  if (next !== "/dashboard") target.searchParams.set("next", next);
  response.headers.set("location", target.toString());

  await recordSecurityEvent({
    userId,
    category: "auth",
    event: "password_accepted",
    severity: "info",
    summary: "Password accepted, waiting for the authenticator code",
    ipHash,
    uaFamily: ua,
    meta: { session: sessionId },
  });

  return response;
}

export function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
