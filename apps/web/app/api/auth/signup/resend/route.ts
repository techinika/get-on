import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { readPendingSignup } from "@/lib/auth/pending";
import { sendSignupCode } from "@/lib/auth/email-otp";
import { PENDING_COOKIE, pendingCookieOptions } from "@/lib/auth/cookies";
import { getIpHash, isSameOrigin, uaFamily } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";
import { securityMessage } from "@/lib/security/messages";
import { signToken } from "@/lib/security/tokens";
import { recordSecurityEvent } from "@/lib/security/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", message: securityMessage("RATE_LIMITED") },
      { status: 403 },
    );
  }

  const pending = await readPendingSignup();
  if (!pending) {
    return NextResponse.json(
      { ok: false, code: "SESSION_EXPIRED", message: securityMessage("SESSION_EXPIRED") },
      { status: 400 },
    );
  }

  const ipHash = getIpHash(request.headers);
  const ua = uaFamily(request.headers.get("user-agent"));
  const emailHash = createHash("sha256").update(pending.email).digest("hex");

  const [perEmail, perIp] = await Promise.all([
    rateLimit(`signup:code:email:${emailHash}`, POLICIES.codeSendPerEmailHash),
    rateLimit(`signup:code:ip:${ipHash}`, POLICIES.codeSendPerIp),
  ]);
  if (!perEmail.ok || !perIp.ok) {
    const retryAfter = Math.max(perEmail.retryAfter, perIp.retryAfter);
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", message: securityMessage("RATE_LIMITED"), retryAfter },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  if (!(await sendSignupCode(pending.email))) {
    return NextResponse.json(
      { ok: false, code: "SOMETHING_WRONG", message: securityMessage("SOMETHING_WRONG") },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const refreshed = signToken(
    { email: pending.email, purpose: "signup_verify", next: pending.next },
    30 * 60,
  );
  cookieStore.set(PENDING_COOKIE, refreshed.value, pendingCookieOptions());

  await recordSecurityEvent({
    category: "account",
    event: "signup_code_resent",
    severity: "info",
    summary: "A new signup code was sent",
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
  });

  return NextResponse.json({ ok: true, maskedEmail: pending.maskedEmail });
}
