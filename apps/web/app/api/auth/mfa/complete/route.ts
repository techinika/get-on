import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { enqueueEmail } from "@/lib/email/enqueue";
import { newDeviceEmail } from "@/lib/email/account-emails";
import {
  BINDING_COOKIE,
  DEVICE_COOKIE,
  PENDING_COOKIE,
} from "@/lib/auth/cookies";
import {
  createPendingSession,
  getSessionRow,
  hashDeviceId,
  markSessionVerified,
  sessionIdFromAccessToken,
  touchDevice,
} from "@/lib/auth/session-security";
import { getIpHash, isSameOrigin, safeNextPath, uaFamily } from "@/lib/security/request";
import { recordSecurityEvent } from "@/lib/security/events";
import { TOKEN_TTL, appOrigin, issueAuthToken } from "@/lib/auth/recovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.json({ ok: false, code: "RATE_LIMITED" }, { status: 403 });
  }

  let next = "/dashboard";
  try {
    const body = (await request.json()) as { next?: unknown };
    next = safeNextPath(body.next, "/dashboard");
  } catch {
    next = "/dashboard";
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const { data: level, error: levelError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (levelError || level?.currentLevel !== "aal2") {
    return NextResponse.json({ ok: false, code: "MFA_REQUIRED" }, { status: 403 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionId = sessionIdFromAccessToken(sessionData.session?.access_token);
  if (!sessionId) {
    return NextResponse.json({ ok: false, code: "SESSION_EXPIRED" }, { status: 401 });
  }

  const ua = uaFamily(request.headers.get("user-agent"));
  const ipHash = getIpHash(request.headers);
  const cookieStore = await cookies();

  const deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  const deviceHash = deviceId ? hashDeviceId(deviceId) : null;
  const existing = await getSessionRow(sessionId);
  if (!existing) {
    await createPendingSession({
      sessionId,
      userId: user.id,
      ipHash,
      uaFamily: ua,
      deviceIdHash: deviceHash,
    });
  }
  if (deviceHash) {
    const { isNew } = await touchDevice({ userId: user.id, deviceIdHash: deviceHash, label: ua });
    if (isNew && user.email) {
      let secureUrl: string | null = null;
      try {
        const notMe = await issueAuthToken({
          userId: user.id,
          purpose: "not_me",
          ttlSeconds: TOKEN_TTL.notMe,
          meta: { sessionId },
        });
        secureUrl = `${appOrigin(request)}/security/not-me?t=${encodeURIComponent(notMe.token)}`;
      } catch {
        secureUrl = null;
      }
      const notice = newDeviceEmail({
        device: ua,
        when: `${new Date().toISOString().slice(0, 10)} ${new Date().toISOString().slice(11, 16)} UTC`,
        country: null,
        secureUrl,
      });
      await enqueueEmail({
        kind: "new_device_sign_in",
        stream: "transactional",
        userId: user.id,
        toEmail: user.email,
        relatedType: "session",
        relatedId: sessionId,
        dedupeKey: `newdevice:${sessionId}`,
        payload: { subject: notice.subject, text: notice.text, html: notice.html },
      });
    }
  }

  try {
    await markSessionVerified({
      sessionId,
      userId: user.id,
      method: "totp",
      challengeId: null,
    });
  } catch (error) {
    console.error("Could not finish MFA sign-in", error);
    return NextResponse.json({ ok: false, code: "SESSION_NOT_VERIFIED" }, { status: 500 });
  }

  await recordSecurityEvent({
    userId: user.id,
    category: "auth",
    event: "login_succeeded",
    severity: "info",
    summary: `Signed in from ${ua} with an authenticator code`,
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
    meta: { session: sessionId },
  });

  const response = NextResponse.json({ ok: true, next });
  response.cookies.delete(PENDING_COOKIE);
  response.cookies.delete(BINDING_COOKIE);
  return response;
}
