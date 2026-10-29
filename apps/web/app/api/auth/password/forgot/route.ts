import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { enqueueEmail } from "@/lib/email/enqueue";
import { passwordResetEmail } from "@/lib/email/account-emails";
import {
  TOKEN_TTL,
  appOrigin,
  findAccountByEmail,
  issueAuthToken,
} from "@/lib/auth/recovery";
import { getIpHash, isSameOrigin } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { recordSecurityEvent } from "@/lib/security/events";
import { uaFamily } from "@/lib/security/request";

export const dynamic = "force-dynamic";

/** The same page and the same words whether or not the address has an account. */
function sent(request: Request) {
  return NextResponse.redirect(new URL("/forgot-password?sent=1", request.url), 303);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.redirect(new URL("/forgot-password?error=RATE_LIMITED", request.url), 303);
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const turnstileToken = form.get("cf-turnstile-response");

  const ipHash = getIpHash(request.headers);
  const ua = uaFamily(request.headers.get("user-agent"));
  const emailHash = createHash("sha256").update(email).digest("hex");

  const turnstile = await verifyTurnstile(typeof turnstileToken === "string" ? turnstileToken : null, {
    action: "password_reset",
  });
  if (!turnstile.ok) {
    await recordSecurityEvent({
      category: "abuse",
      event: "turnstile_failed",
      severity: "notice",
      summary: "Password reset blocked by the human check",
      ipHash,
      uaFamily: ua,
    });
    return NextResponse.redirect(new URL("/forgot-password?error=TURNSTILE_FAILED", request.url), 303);
  }

  const [perEmail, perIp] = await Promise.all([
    rateLimit(`reset:email:${emailHash}`, POLICIES.passwordResetPerEmail),
    rateLimit(`reset:ip:${ipHash}`, POLICIES.passwordResetPerIp),
  ]);
  if (!perEmail.ok || !perIp.ok) {
    return NextResponse.redirect(new URL("/forgot-password?error=RATE_LIMITED", request.url), 303);
  }

  try {
    const account = await findAccountByEmail(email);
    if (account && account.verified) {
      const { token } = await issueAuthToken({
        userId: account.id,
        purpose: "password_reset",
        ttlSeconds: TOKEN_TTL.passwordReset,
        meta: { ipHash },
        replaceOpen: true,
      });

      const rendered = passwordResetEmail({
        url: `${appOrigin(request)}/reset-password?t=${encodeURIComponent(token)}`,
        minutes: Math.round(TOKEN_TTL.passwordReset / 60),
      });
      await enqueueEmail({
        kind: "password_reset",
        stream: "transactional",
        userId: account.id,
        toEmail: account.email,
        relatedType: "account",
        relatedId: account.id,
        dedupeKey: `reset:${token.slice(0, 12)}`,
        payload: { subject: rendered.subject, text: rendered.text, html: rendered.html },
      });

      await recordSecurityEvent({
        userId: account.id,
        category: "password",
        event: "password_reset_requested",
        severity: "notice",
        summary: "A password reset link was requested",
        ipHash,
        uaFamily: ua,
        visibleToUser: true,
      });
    } else {
      await recordSecurityEvent({
        category: "password",
        event: "password_reset_unknown_email",
        severity: "info",
        summary: "A password reset was requested for an address without an account",
        ipHash,
        uaFamily: ua,
      });
    }
  } catch (error) {
    // A mail or database problem must not reveal whether the account exists.
    console.error("[security] password reset request failed:", (error as Error)?.message ?? error);
  }

  // Keep the two branches close in time so the response cannot be used to probe.
  await new Promise((resolve) => setTimeout(resolve, 120 + Math.floor(Math.random() * 180)));
  return sent(request);
}

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/forgot-password", request.url), 303);
}
