import { NextResponse } from "next/server";
import { enqueueEmail } from "@/lib/email/enqueue";
import { passwordChangedEmail } from "@/lib/email/account-emails";
import {
  consumeAuthToken,
  findAuthToken,
  getAccountEmail,
  invalidateOpenTokens,
  revokeAllSessions,
  setUserPassword,
} from "@/lib/auth/recovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIpHash, isSameOrigin, uaFamily } from "@/lib/security/request";
import { checkPasswordPolicy, isPasswordBreached } from "@/lib/security/passwords";
import { getSecuritySettings } from "@/lib/security/settings";
import { recordSecurityEvent } from "@/lib/security/events";

export const dynamic = "force-dynamic";

function back(request: Request, token: string, code: string) {
  const url = new URL("/reset-password", request.url);
  url.searchParams.set("t", token);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request, [process.env.APP_ORIGIN ?? ""])) {
    return NextResponse.redirect(new URL("/reset-password?error=RATE_LIMITED", request.url), 303);
  }

  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const row = await findAuthToken(token, "password_reset");
  if (!row) {
    return NextResponse.redirect(new URL("/reset-password?error=TOKEN_INVALID", request.url), 303);
  }

  if (password !== confirm) return back(request, token, "AUTH_PASSWORD_MISMATCH");

  const admin = createAdminClient();
  const [{ data: profile }, email] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", row.userId).maybeSingle(),
    getAccountEmail(row.userId),
  ]);

  const settings = await getSecuritySettings();
  const check = checkPasswordPolicy(password, {
    email,
    name: profile?.full_name ? String(profile.full_name) : undefined,
    minLength: settings.minPasswordLength,
  });
  if (!check.ok) {
    if (check.errors.includes("CONTAINS_PERSONAL")) return back(request, token, "AUTH_PASSWORD_PERSONAL");
    if (check.errors.includes("TOO_SHORT") && check.errors.length === 1) return back(request, token, "AUTH_PASSWORD_TOO_SHORT");
    return back(request, token, "AUTH_PASSWORD_WEAK");
  }

  const breach = await isPasswordBreached(password, settings.hibpEnabled);
  if (breach.breached) return back(request, token, "AUTH_PASSWORD_BREACHED");

  // Use the link before changing anything. A consumed link can never be replayed.
  if (!(await consumeAuthToken(row.id))) {
    return NextResponse.redirect(new URL("/reset-password?error=TOKEN_INVALID", request.url), 303);
  }

  const changed = await setUserPassword(row.userId, password);
  if (!changed) {
    return NextResponse.redirect(new URL("/reset-password?error=SOMETHING_WRONG", request.url), 303);
  }

  await invalidateOpenTokens(row.userId, "password_reset");
  await revokeAllSessions(row.userId, "password_changed");

  const ipHash = getIpHash(request.headers);
  const ua = uaFamily(request.headers.get("user-agent"));
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const notice = passwordChangedEmail({ when });
  await enqueueEmail({
    kind: "password_changed",
    stream: "transactional",
    userId: row.userId,
    toEmail: email,
    relatedType: "account",
    relatedId: row.userId,
    dedupeKey: `password-changed:${row.id}`,
    payload: { subject: notice.subject, text: notice.text, html: notice.html },
  });

  await recordSecurityEvent({
    userId: row.userId,
    category: "password",
    event: "password_changed",
    severity: "critical",
    summary: "Password reset with a link, every session signed out",
    ipHash,
    uaFamily: ua,
    visibleToUser: true,
  });

  return NextResponse.redirect(new URL("/reset-password?done=1", request.url), 303);
}
