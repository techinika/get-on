import { createAdminClient } from "@/lib/supabase/admin";
import { attributeReferral } from "@/lib/referrals";
import { canonicalEmail } from "@/lib/security/canonical-email";
import { validateEmailAddress, isDisposableDomain, isBlockedDomain } from "@/lib/security/email-address";
import { checkPasswordPolicy, isPasswordBreached } from "@/lib/security/passwords";
import { hashEmail } from "@/lib/security/otp";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSecuritySettings } from "@/lib/security/settings";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { hashBrowserBinding, newBindingValue } from "@/lib/security/otp";
import { tokenSecret } from "@/lib/security/tokens";
import { emailOtpProvider } from "@/lib/auth/second-factor";
import { recordSecurityEvent } from "@/lib/security/events";

export type RegisterInput = {
  email: string;
  password: string;
  fullName?: string;
  termsAccepted: boolean;
  marketingOptIn?: boolean;
  timezone?: string | null;
  ipHash: string;
  uaFamily: string;
  turnstileToken?: string | null;
  referralCode?: string | null;
};

export type RegisterErrorCode =
  | "AUTH_EMAIL_INVALID"
  | "AUTH_EMAIL_DISPOSABLE"
  | "AUTH_EMAIL_EXISTS"
  | "AUTH_EMAIL_EXISTS_UNVERIFIED"
  | "AUTH_EMAIL_EXISTS_GOOGLE"
  | "AUTH_PASSWORD_WEAK"
  | "AUTH_PASSWORD_BREACHED"
  | "AUTH_TERMS_REQUIRED"
  | "RATE_LIMITED"
  | "TURNSTILE_FAILED"
  | "REGISTRATION_CLOSED"
  | "SOMETHING_WRONG";

export type RegisterResult =
  | {
      ok: true;
      challengeId: string;
      email: string;
      maskedEmail: string;
      bindingValue: string;
      bindingHash: string;
    }
  | {
      ok: false;
      code: RegisterErrorCode;
      field?: "email" | "password" | "terms" | "form";
      passwordErrors?: string[];
      retryAfter?: number;
      /** Set when an unverified account already exists and a new code was sent. */
      pending?: {
        challengeId: string;
        email: string;
        maskedEmail: string;
        bindingValue: string;
        bindingHash: string;
      };
    };

function fail(
  code: RegisterErrorCode,
  field?: "email" | "password" | "terms" | "form",
  extra: { passwordErrors?: string[]; retryAfter?: number } = {},
): RegisterResult {
  return { ok: false, code, field, ...extra };
}

async function findProfileByCanonical(canonical: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id,email_canonical,duplicate_of")
    .eq("email_canonical", canonical)
    .is("duplicate_of", null)
    .maybeSingle();
  return data;
}

/**
 * The only signup path. The auth service's own signup endpoint must be closed
 * (or guarded by the before-user-created hook) so these rules cannot be
 * bypassed with the public anon key.
 */
export async function registerAccount(input: RegisterInput): Promise<RegisterResult> {
  const settings = await getSecuritySettings();
  const admin = createAdminClient();

  const validation = validateEmailAddress(input.email);
  if (!validation.ok) return fail("AUTH_EMAIL_INVALID", "email");
  const email = validation.email;
  const canonical = canonicalEmail(email);

  if (!input.termsAccepted) return fail("AUTH_TERMS_REQUIRED", "terms");
  if (!settings.registrationOpen) return fail("REGISTRATION_CLOSED", "form");

  if (settings.disposableBlock && (await isDisposableDomain(validation.domain))) {
    return fail("AUTH_EMAIL_DISPOSABLE", "email");
  }
  if (await isBlockedDomain(validation.domain)) {
    return fail("AUTH_EMAIL_DISPOSABLE", "email");
  }

  const password = checkPasswordPolicy(input.password, {
    email,
    name: input.fullName,
    minLength: settings.minPasswordLength,
  });
  if (!password.ok) {
    return fail("AUTH_PASSWORD_WEAK", "password", { passwordErrors: password.errors });
  }
  const breached = await isPasswordBreached(input.password, settings.hibpEnabled);
  if (breached.breached) return fail("AUTH_PASSWORD_BREACHED", "password");

  const [perHour, perDay] = await Promise.all([
    rateLimit(`register:ip:hour:${input.ipHash}`, {
      limit: settings.registerPerIpHour,
      windowSeconds: 3600,
    }),
    rateLimit(`register:ip:day:${input.ipHash}`, {
      limit: settings.registerPerIpDay,
      windowSeconds: 86_400,
    }),
  ]);
  if (!perHour.ok || !perDay.ok) {
    return fail("RATE_LIMITED", "form", { retryAfter: Math.max(perHour.retryAfter, perDay.retryAfter) });
  }

  const turnstile = await verifyTurnstile(input.turnstileToken, { action: "signup" });
  if (!turnstile.ok) return fail("TURNSTILE_FAILED", "form");

  const bindingValue = newBindingValue();
  const bindingHash = hashBrowserBinding(bindingValue, tokenSecret());

  const existing = await findProfileByCanonical(canonical);
  if (existing) {
    const { data } = await admin.auth.admin.getUserById(String(existing.id));
    const user = data.user;
    if (user?.email_confirmed_at) {
      const isGoogle = (user.app_metadata?.providers ?? []).includes("google");
      return fail(isGoogle ? "AUTH_EMAIL_EXISTS_GOOGLE" : "AUTH_EMAIL_EXISTS", "email");
    }

    // Unverified account: send a fresh code, never create a second row.
    try {
      const challenge = await emailOtpProvider.challenge("signup_verify", {
        userId: String(existing.id),
        email,
        browserBindingHash: bindingHash,
        ipHash: input.ipHash,
        uaFamily: input.uaFamily,
      });
      await admin
        .from("profiles")
        .update({ terms_accepted_at: new Date().toISOString(), timezone: input.timezone ?? "UTC" })
        .eq("id", String(existing.id));
      return {
        ok: false,
        code: "AUTH_EMAIL_EXISTS_UNVERIFIED",
        field: "email",
        pending: {
          challengeId: challenge.challengeId,
          email,
          maskedEmail: challenge.maskedEmail,
          bindingValue,
          bindingHash,
        },
      };
    } catch {
      return fail("SOMETHING_WRONG", "form");
    }
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: false,
    user_metadata: {
      full_name: input.fullName ?? "",
      marketing_opt_in: Boolean(input.marketingOptIn),
    },
  });

  if (error || !created.user) {
    if (/already|exists|registered/i.test(error?.message ?? "")) {
      return fail("AUTH_EMAIL_EXISTS", "email");
    }
    console.error("[security] registration failed:", error?.message);
    return fail("SOMETHING_WRONG", "form");
  }

  const userId = created.user.id;

  await admin
    .from("profiles")
    .update({
      email_canonical: canonical,
      email_verified_at: null,
      terms_accepted_at: new Date().toISOString(),
      timezone: input.timezone ?? "UTC",
      signup_ip_hash: input.ipHash,
      two_factor_enabled: true,
    })
    .eq("id", userId);

  if (input.referralCode) {
    try {
      await attributeReferral({
        admin,
        userId,
        email,
        code: input.referralCode,
        ip: null,
        userAgent: input.uaFamily,
      });
    } catch (referralError) {
      console.warn("[referrals] attribution failed", referralError);
    }
  }

  try {
    await admin.from("signup_attempts").insert({
      email_hash: hashEmail(email),
      canonical_hash: hashEmail(canonical),
      ip_hash: input.ipHash,
      result: "created",
    });
  } catch {
    // analysis only
  }

  await recordSecurityEvent({
    userId,
    category: "account",
    event: "registration_started",
    severity: "info",
    summary: "New account created, waiting for the email code",
    ipHash: input.ipHash,
    uaFamily: input.uaFamily,
    visibleToUser: true,
    meta: {},
  });

  let challenge;
  try {
    challenge = await emailOtpProvider.challenge("signup_verify", {
      userId,
      email,
      browserBindingHash: bindingHash,
      ipHash: input.ipHash,
      uaFamily: input.uaFamily,
    });
  } catch {
    return fail("SOMETHING_WRONG", "form");
  }

  return {
    ok: true,
    challengeId: challenge.challengeId,
    email,
    maskedEmail: challenge.maskedEmail,
    bindingValue,
    bindingHash,
  };
}
