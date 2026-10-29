import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueEmail } from "@/lib/email/enqueue";
import { securityCodeEmail } from "@/lib/email/security-code";
import { canonicalEmail } from "@/lib/security/canonical-email";
import {
  challengeHash,
  currentPepper,
  generateCode,
  hashEmail,
  isCodeShape,
  maskEmail,
  normaliseCode,
  pepperForVersion,
  verifyCodeConstantTime,
} from "@/lib/security/otp";
import { getSecuritySettings } from "@/lib/security/settings";
import { rateLimit } from "@/lib/security/rate-limit";
import { POLICIES } from "@/lib/security/policies";

export type SecondFactorPurpose =
  | "signup_verify"
  | "login"
  | "step_up"
  | "email_change_old"
  | "email_change_new"
  | "recovery";

export type ChallengeContext = {
  userId?: string | null;
  email?: string | null;
  sessionId?: string | null;
  browserBindingHash?: string | null;
  ipHash?: string | null;
  uaFamily?: string | null;
  country?: string | null;
  notMeBaseUrl?: string | null;
};

export type ChallengeResult = {
  challengeId: string;
  expiresAt: string;
  maskedEmail: string;
  email: string;
};

export type VerifyResult =
  | { ok: true; userId: string | null; purpose: SecondFactorPurpose; email: string; sessionId: string | null }
  | { ok: false; code: "OTP_INVALID" | "OTP_EXPIRED" | "OTP_LOCKED"; remaining?: number };

export type IssueResult = ChallengeResult | { ok: false; code: "OTP_RESEND_WAIT" | "OTP_RESEND_LIMIT"; retryAfter?: number };

export interface SecondFactorProvider {
  id: string;
  strength: number;
  challenge(purpose: SecondFactorPurpose, ctx: ChallengeContext): Promise<ChallengeResult>;
  resend(challengeId: string, ctx: ChallengeContext): Promise<IssueResult>;
  verify(challengeId: string, code: string, ctx: ChallengeContext): Promise<VerifyResult>;
}

const RESEND_COOLDOWN_SECONDS = 60;

function isIssueError(value: ChallengeResult | IssueResult): value is Extract<IssueResult, { ok: false }> {
  return "ok" in value && value.ok === false;
}

async function resolveEmail(ctx: ChallengeContext): Promise<string | null> {
  if (ctx.email) return ctx.email.trim().toLowerCase();
  if (!ctx.userId) return null;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(ctx.userId);
  return data.user?.email?.trim().toLowerCase() ?? null;
}

async function minutesFor(purpose: SecondFactorPurpose): Promise<number> {
  const settings = await getSecuritySettings();
  switch (purpose) {
    case "signup_verify":
      return settings.signupCodeMinutes;
    case "login":
    case "step_up":
      return settings.loginCodeMinutes;
    case "email_change_old":
    case "email_change_new":
      return 15;
    case "recovery":
      return 30;
  }
}

export class EmailOtpProvider implements SecondFactorProvider {
  id = "email_otp";
  strength = 1;

  async challenge(purpose: SecondFactorPurpose, ctx: ChallengeContext): Promise<ChallengeResult> {
    const issued = await this.issue(purpose, ctx, { checkCooldown: false });
    if (isIssueError(issued)) throw new Error(issued.code);
    return issued;
  }

  async resend(challengeId: string, ctx: ChallengeContext): Promise<IssueResult> {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("auth_challenges")
      .select("id,user_id,email_hash,purpose,session_id,consumed_at")
      .eq("id", challengeId)
      .maybeSingle();
    if (!row || row.consumed_at) return { ok: false, code: "OTP_RESEND_LIMIT" };
    return this.issue(String(row.purpose) as SecondFactorPurpose, {
      ...ctx,
      userId: row.user_id ? String(row.user_id) : ctx.userId ?? null,
      sessionId: row.session_id ? String(row.session_id) : ctx.sessionId ?? null,
    }, { checkCooldown: true });
  }

  private async issue(
    purpose: SecondFactorPurpose,
    ctx: ChallengeContext,
    options: { checkCooldown: boolean },
  ): Promise<ChallengeResult | Extract<IssueResult, { ok: false }>> {
    const admin = createAdminClient();
    const email = await resolveEmail(ctx);
    if (!email || !canonicalEmail(email)) throw new Error("MISSING_SUBJECT");

    const emailHash = hashEmail(canonicalEmail(email));
    const subjectKey = ctx.userId ?? emailHash;

    if (options.checkCooldown) {
      const { data: latest } = await admin
        .from("auth_challenges")
        .select("created_at")
        .eq("purpose", purpose)
        .eq(ctx.userId ? "user_id" : "email_hash", subjectKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.created_at) {
        const elapsed = (Date.now() - new Date(String(latest.created_at)).getTime()) / 1000;
        if (elapsed < RESEND_COOLDOWN_SECONDS) {
          return { ok: false, code: "OTP_RESEND_WAIT", retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) };
        }
      }
    }

    // Hourly send limits, per subject and per network.
    const limits = await Promise.all([
      rateLimit(`otp:send:subject:${subjectKey}`, POLICIES.codeSendPerUser),
      rateLimit(`otp:send:email:${emailHash}`, POLICIES.codeSendPerEmailHash),
      rateLimit(`otp:send:ip:${ctx.ipHash ?? "unknown"}`, POLICIES.codeSendPerIp),
    ]);
    if (limits.some((result) => !result.ok)) {
      return { ok: false, code: "OTP_RESEND_LIMIT" };
    }

    // A new code always invalidates the previous one for the same purpose.
    await admin
      .from("auth_challenges")
      .update({ invalidated_at: new Date().toISOString() })
      .eq("purpose", purpose)
      .is("consumed_at", null)
      .is("invalidated_at", null)
      .eq(ctx.userId ? "user_id" : "email_hash", subjectKey);

    const settings = await getSecuritySettings();
    const minutes = await minutesFor(purpose);
    const challengeId = randomUUID();
    const code = generateCode(settings.otpLength);
    const pepper = currentPepper();
    const hash = challengeHash(purpose, subjectKey, challengeId, code, pepper.secret);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const { error } = await admin.from("auth_challenges").insert({
      id: challengeId,
      user_id: ctx.userId ?? null,
      email_hash: emailHash,
      purpose,
      code_hash: hash,
      pepper_version: pepper.version,
      expires_at: expiresAt,
      max_attempts: 5,
      browser_binding_hash: ctx.browserBindingHash ?? null,
      ip_hash: ctx.ipHash ?? null,
      ua_family: ctx.uaFamily ?? null,
      session_id: ctx.sessionId ?? null,
    });
    if (error) {
      console.error("[security] could not create challenge:", error.message);
      throw new Error("CHALLENGE_FAILED");
    }

    const rendered = securityCodeEmail({
      purpose,
      code,
      minutes,
      when: new Date(),
      browser: ctx.uaFamily ?? "Unknown browser",
      country: ctx.country ?? null,
      notMeUrl: ctx.notMeBaseUrl ?? null,
    });

    await enqueueEmail({
      kind: "security_code",
      stream: "transactional",
      toEmail: email,
      userId: ctx.userId ?? null,
      relatedType: "auth_challenge",
      relatedId: challengeId,
      dedupeKey: `otp:${challengeId}`,
      payload: {
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        reason: "You receive this email because someone tried to use your Get-On account.",
      },
    });

    return { challengeId, expiresAt, maskedEmail: maskEmail(email), email };
  }

  async verify(challengeId: string, input: string, ctx: ChallengeContext): Promise<VerifyResult> {
    const admin = createAdminClient();
    const settings = await getSecuritySettings();
    const code = normaliseCode(input);
    if (!isCodeShape(code, settings.otpLength)) {
      return { ok: false, code: "OTP_INVALID" };
    }

    const { data: row } = await admin
      .from("auth_challenges")
      .select(
        "id,user_id,email_hash,purpose,code_hash,pepper_version,expires_at,attempts,max_attempts,consumed_at,invalidated_at,browser_binding_hash,session_id",
      )
      .eq("id", challengeId)
      .maybeSingle();
    if (!row || row.consumed_at || row.invalidated_at) return { ok: false, code: "OTP_INVALID" };

    if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
      await admin.from("auth_challenges").update({ invalidated_at: new Date().toISOString() }).eq("id", challengeId);
      return { ok: false, code: "OTP_EXPIRED" };
    }

    // The code only works in the browser that started the challenge.
    if (!row.browser_binding_hash || row.browser_binding_hash !== (ctx.browserBindingHash ?? null)) {
      return { ok: false, code: "OTP_INVALID" };
    }
    // Login and step-up codes only work on the session they were issued for.
    if (row.session_id && row.session_id !== (ctx.sessionId ?? null)) {
      return { ok: false, code: "OTP_INVALID" };
    }

    if (Number(row.attempts) >= Number(row.max_attempts)) {
      return { ok: false, code: "OTP_LOCKED" };
    }

    const pepper = pepperForVersion(Number(row.pepper_version));
    const subjectKey = row.user_id ? String(row.user_id) : String(row.email_hash);
    const candidate = challengeHash(String(row.purpose), subjectKey, challengeId, code, pepper.secret);
    const matches = verifyCodeConstantTime(String(row.code_hash), candidate);

    const nextAttempts = Number(row.attempts) + 1;
    if (!matches) {
      const { data: updated } = await admin
        .from("auth_challenges")
        .update({ attempts: nextAttempts })
        .eq("id", challengeId)
        .select("attempts")
        .maybeSingle();
      const remaining = Math.max(0, Number(row.max_attempts) - Number(updated?.attempts ?? nextAttempts));
      if (remaining === 0) {
        await admin.from("auth_challenges").update({ invalidated_at: new Date().toISOString() }).eq("id", challengeId);
        return { ok: false, code: "OTP_LOCKED" };
      }
      return { ok: false, code: "OTP_INVALID", remaining };
    }

    // Consume exactly once, even when two requests arrive together.
    const { data: consumed } = await admin
      .from("auth_challenges")
      .update({ consumed_at: new Date().toISOString(), attempts: nextAttempts })
      .eq("id", challengeId)
      .is("consumed_at", null)
      .is("invalidated_at", null)
      .select("id")
      .maybeSingle();
    if (!consumed) return { ok: false, code: "OTP_INVALID" };

    const email = await resolveEmail({
      userId: row.user_id ? String(row.user_id) : null,
      email: ctx.email ?? null,
    });

    return {
      ok: true,
      userId: row.user_id ? String(row.user_id) : null,
      purpose: String(row.purpose) as SecondFactorPurpose,
      email: email ?? "",
      sessionId: row.session_id ? String(row.session_id) : null,
    };
  }
}

export const emailOtpProvider: SecondFactorProvider = new EmailOtpProvider();
