import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, newToken } from "@/lib/security/otp";

/**
 * Links that change something on an account (reset a password, undo an email
 * change, secure an account after a sign-in the owner did not make) are
 * single-use database tokens. Only the hash is stored; the page that the link
 * opens never changes anything on a `GET`, only the `POST` from that page does.
 */

export type AuthTokenPurpose = "password_reset" | "email_change_undo" | "not_me" | "account_recovery" | "unlock";

export const TOKEN_TTL = {
  passwordReset: 30 * 60,
  notMe: 24 * 60 * 60,
  emailChangeUndo: 72 * 60 * 60,
  accountRecovery: 72 * 60 * 60,
} as const;

export type AuthTokenRow = {
  id: string;
  userId: string;
  purpose: AuthTokenPurpose;
  expiresAt: string;
  meta: Record<string, unknown>;
};

export type AccountRow = {
  id: string;
  email: string;
  verified: boolean;
};

/** Absolute origin for links in email. Never trust a browser supplied value. */
export function appOrigin(request?: Request): string {
  const configured = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

export function maskAddress(email: string): string {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "your email address";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function findAccountByEmail(email: string): Promise<AccountRow | null> {
  const admin = createAdminClient();
  const normalised = email.trim().toLowerCase();
  if (!normalised.includes("@")) return null;
  const { data } = await admin
    .from("profiles")
    .select("id,email_canonical,email_verified_at,duplicate_of")
    .eq("email_canonical", normalised)
    .is("duplicate_of", null)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    email: String(data.email_canonical ?? normalised),
    verified: Boolean(data.email_verified_at),
  };
}

export async function issueAuthToken(input: {
  userId: string;
  purpose: AuthTokenPurpose;
  ttlSeconds: number;
  meta?: Record<string, unknown>;
  replaceOpen?: boolean;
}): Promise<{ token: string; expiresAt: string }> {
  const admin = createAdminClient();
  if (input.replaceOpen) {
    await admin
      .from("auth_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", input.userId)
      .eq("purpose", input.purpose)
      .is("used_at", null);
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString();
  const { error } = await admin.from("auth_tokens").insert({
    user_id: input.userId,
    purpose: input.purpose,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    meta: input.meta ?? {},
  });
  if (error) {
    console.error("[security] could not store token:", error.message);
    throw new Error("TOKEN_FAILED");
  }
  return { token, expiresAt };
}

/** Looks up a token without using it. Returns null for used, expired or unknown. */
export async function findAuthToken(raw: string | null | undefined, purpose: AuthTokenPurpose): Promise<AuthTokenRow | null> {
  const value = typeof raw === "string" ? raw.trim() : "";
  // A real token is 43 base64url characters. Reject junk before touching the database.
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(value)) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("auth_tokens")
      .select("id,user_id,purpose,expires_at,used_at,meta")
      .eq("token_hash", hashToken(value))
      .eq("purpose", purpose)
      .maybeSingle();
    if (!data || data.used_at) return null;
    if (new Date(String(data.expires_at)).getTime() <= Date.now()) return null;

    return {
      id: String(data.id),
      userId: String(data.user_id),
      purpose: String(data.purpose) as AuthTokenPurpose,
      expiresAt: String(data.expires_at),
      meta: (data.meta as Record<string, unknown> | null) ?? {},
    };
  } catch (error) {
    // A database problem must not turn the page into a crash. The link shows
    // the ordinary "no longer valid" card and the user can ask for a new one.
    console.warn("[security] token lookup failed:", (error as Error)?.message ?? error);
    return null;
  }
}

/** Uses the token exactly once, even when two requests arrive together. */
export async function consumeAuthToken(id: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function invalidateOpenTokens(userId: string, purpose: AuthTokenPurpose): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .is("used_at", null);
}

/**
 * Signs the account out everywhere. The database function `session_verified()`
 * stops accepting a revoked session at once, so the JWT that is still in a
 * browser cannot reach a page even before it expires.
 */
export async function revokeAllSessions(userId: string, reason: string, exceptSessionId?: string | null): Promise<void> {
  const admin = createAdminClient();
  let query = admin
    .from("session_security")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason.slice(0, 120) })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (exceptSessionId) query = query.neq("session_id", exceptSessionId);
  await query;
}

export async function setUserPassword(userId: string, password: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("[security] could not set password:", error.message);
    return false;
  }
  return true;
}

export async function getAccountEmail(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email?.trim().toLowerCase() ?? "";
}
