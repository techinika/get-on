import { NextResponse } from "next/server";
import { enqueueEmail } from "@/lib/email/enqueue";
import { passwordResetEmail } from "@/lib/email/account-emails";
import {
  TOKEN_TTL,
  appOrigin,
  consumeAuthToken,
  findAuthToken,
  getAccountEmail,
  invalidateOpenTokens,
  issueAuthToken,
  revokeAllSessions,
} from "@/lib/auth/recovery";
import { getIpHash, isSameOrigin, uaFamily } from "@/lib/security/request";
import { recordSecurityEvent } from "@/lib/security/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.redirect(new URL("/security/not-me?error=RATE_LIMITED", request.url), 303);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const row = await findAuthToken(token, "not_me");
  if (!row) {
    return NextResponse.redirect(new URL("/security/not-me?error=TOKEN_INVALID", request.url), 303);
  }
  if (!(await consumeAuthToken(row.id))) {
    return NextResponse.redirect(new URL("/security/not-me?error=TOKEN_INVALID", request.url), 303);
  }

  await revokeAllSessions(row.userId, "not_me_reported");
  await invalidateOpenTokens(row.userId, "password_reset");

  const email = await getAccountEmail(row.userId);
  let resetSent = false;
  if (email) {
    const { token: resetToken } = await issueAuthToken({
      userId: row.userId,
      purpose: "password_reset",
      ttlSeconds: TOKEN_TTL.passwordReset,
      meta: { reason: "not_me" },
    });
    const rendered = passwordResetEmail({
      url: `${appOrigin(request)}/reset-password?t=${encodeURIComponent(resetToken)}`,
      minutes: Math.round(TOKEN_TTL.passwordReset / 60),
    });
    const queued = await enqueueEmail({
      kind: "password_reset",
      stream: "transactional",
      userId: row.userId,
      toEmail: email,
      relatedType: "account",
      relatedId: row.userId,
      dedupeKey: `reset:${resetToken.slice(0, 12)}`,
      payload: { subject: rendered.subject, text: rendered.text, html: rendered.html },
    });
    resetSent = queued.ok;
  }

  const ipHash = getIpHash(request.headers);
  await recordSecurityEvent({
    userId: row.userId,
    category: "session",
    event: "not_me_reported",
    severity: "critical",
    summary: "The owner reported a sign-in they did not make; every session was signed out",
    ipHash,
    uaFamily: uaFamily(request.headers.get("user-agent")),
    visibleToUser: true,
  });

  const url = new URL("/security/not-me", request.url);
  url.searchParams.set("done", "1");
  if (!resetSent) url.searchParams.set("error", "SOMETHING_WRONG");
  return NextResponse.redirect(url, 303);
}
