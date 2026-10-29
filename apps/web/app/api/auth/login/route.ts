import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailOtpProvider } from "@/lib/auth/second-factor";
import {
  BINDING_COOKIE,
  DEVICE_COOKIE,
  PENDING_COOKIE,
  bindingCookieOptions,
  deviceCookieOptions,
  pendingCookieOptions,
} from "@/lib/auth/cookies";
import {
  createPendingSession,
  hashDeviceId,
  sessionIdFromAccessToken,
  touchDevice,
} from "@/lib/auth/session-security";
import { getIpHash, isSameOrigin, safeNextPath, uaFamily } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { peekRateLimit, rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { hashBrowserBinding, newBindingValue } from "@/lib/security/otp";
import { signToken, tokenSecret } from "@/lib/security/tokens";
import { recordSecurityEvent } from "@/lib/security/events";
import { getSecuritySettings } from "@/lib/security/settings";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

/** Same text and shape for unknown accounts and wrong passwords. */
function loginFailed(request: Request, code: string, next: string, retryAfter?: number) {
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
    return loginFailed(request, "AUTH_LOCKED", next, Math.max(perEmail.retryAfter, perIp.retryAfter));
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

  const redirectTo = new URL("/login/verify", request.url);
  if (next !== "/dashboard") redirectTo.searchParams.set("next", next);
  const response = NextResponse.redirect(redirectTo, 303);
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

  const cookieStore = await cookies();
  const bindingValue = newBindingValue();
  const bindingHash = hashBrowserBinding(bindingValue, tokenSecret());

  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newBindingValue();
    response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  }
  const deviceHash = hashDeviceId(deviceId);

  await createPendingSession({ sessionId, userId, ipHash, uaFamily: ua, deviceIdHash: deviceHash });
  await touchDevice({ userId, deviceIdHash: deviceHash, label: ua });

  let challenge;
  try {
    challenge = await emailOtpProvider.challenge("login", {
      userId,
      email: data.user.email ?? email,
      sessionId,
      browserBindingHash: bindingHash,
      ipHash,
      uaFamily: ua,
    });
  } catch {
    return loginFailed(request, "SOMETHING_WRONG", next);
  }

  const pending = signToken({ challengeId: challenge.challengeId, purpose: "login", next }, 30 * 60);
  response.cookies.set(BINDING_COOKIE, bindingValue, bindingCookieOptions());
  response.cookies.set(PENDING_COOKIE, pending.value, pendingCookieOptions());

  await recordSecurityEvent({
    userId,
    category: "auth",
    event: "password_accepted",
    severity: "info",
    summary: "Password accepted, waiting for the email code",
    ipHash,
    uaFamily: ua,
    meta: { session: sessionId },
  });

  return response;
}

export function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
