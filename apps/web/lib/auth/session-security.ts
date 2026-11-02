import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSecuritySettings } from "@/lib/security/settings";
import { tokenSecret } from "@/lib/security/tokens";

export type SessionRow = {
  session_id: string;
  user_id: string;
  verified_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  idle_expires_at: string;
};

export { sessionIdFromAccessToken } from "@/lib/auth/session-id";

export function hashDeviceId(deviceId: string): string {
  return createHmac("sha256", tokenSecret()).update(`device:${deviceId}`).digest("hex");
}

/**
 * The database treats a session as usable only when the profile is marked as
 * email-verified. Accounts confirmed outside this app (or before the column
 * existed) can be missing that flag, which makes every RLS read return empty
 * even though the auth session is valid. Sync it from Supabase on sign-in.
 */
export async function syncProfileConfirmation(input: {
  userId: string;
  emailConfirmedAt?: string | null;
}): Promise<void> {
  if (!input.emailConfirmedAt) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ email_verified_at: input.emailConfirmedAt, last_sign_in_at: now })
    .eq("id", input.userId);
  if (error) {
    throw new Error(`Could not sync the profile email confirmation: ${error.message}`);
  }
}

export async function createPendingSession(input: {
  sessionId: string;
  userId: string;
  ipHash?: string | null;
  uaFamily?: string | null;
  deviceIdHash?: string | null;
  country?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const settings = await getSecuritySettings();
  const now = Date.now();
  const { error } = await admin.from("session_security").upsert(
    {
      session_id: input.sessionId,
      user_id: input.userId,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + settings.sessionDays * 86_400_000).toISOString(),
      idle_expires_at: new Date(now + settings.sessionIdleDays * 86_400_000).toISOString(),
      last_seen_at: new Date(now).toISOString(),
      ip_hash: input.ipHash ?? null,
      ua_family: input.uaFamily ?? null,
      device_id_hash: input.deviceIdHash ?? null,
      country: input.country ?? null,
      revoked_at: null,
      revoked_reason: null,
      verified_at: null,
      verified_method: null,
      verified_challenge_id: null,
    },
    { onConflict: "session_id" },
  );
  if (error) {
    throw new Error(`Could not save the sign-in session: ${error.message}`);
  }
}

export async function markSessionVerified(input: {
  sessionId: string;
  userId: string;
  challengeId?: string | null;
  method?: "email_otp" | "signup_otp" | "totp";
}): Promise<void> {
  const admin = createAdminClient();
  const settings = await getSecuritySettings();
  const now = Date.now();
  const { data, error } = await admin
    .from("session_security")
    .update({
      verified_at: new Date(now).toISOString(),
      verified_method: input.method ?? "email_otp",
      verified_challenge_id: input.challengeId ?? null,
      expires_at: new Date(now + settings.sessionDays * 86_400_000).toISOString(),
      idle_expires_at: new Date(now + settings.sessionIdleDays * 86_400_000).toISOString(),
      last_seen_at: new Date(now).toISOString(),
    })
    .eq("session_id", input.sessionId)
    .eq("user_id", input.userId)
    .select("session_id");
  if (error) {
    throw new Error(`Could not mark the sign-in session as verified: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("Could not find the sign-in session to verify.");
  }
}

export async function getSessionRow(sessionId: string): Promise<SessionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("session_security")
    .select("session_id,user_id,verified_at,revoked_at,expires_at,idle_expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

/** True only when the session is verified, fresh and not revoked. */
export async function isSessionUsable(sessionId: string, userId: string): Promise<boolean> {
  const row = await getSessionRow(sessionId);
  if (!row || row.user_id !== userId) return false;
  if (row.revoked_at || !row.verified_at) return false;
  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) return false;
  if (new Date(row.idle_expires_at).getTime() <= now) return false;
  return true;
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("session_security")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("session_id", sessionId)
    .is("revoked_at", null);
}

/**
 * Returns true when this is a device the account has not used before. The
 * first device of a new account is not "new" for notification purposes.
 */
export async function touchDevice(input: {
  userId: string;
  deviceIdHash: string;
  label: string;
}): Promise<{ isNew: boolean }> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("user_devices")
    .select("device_id_hash")
    .eq("user_id", input.userId)
    .eq("device_id_hash", input.deviceIdHash)
    .maybeSingle();
  const { count } = await admin
    .from("user_devices")
    .select("device_id_hash", { count: "exact", head: true })
    .eq("user_id", input.userId);

  await admin.from("user_devices").upsert(
    {
      user_id: input.userId,
      device_id_hash: input.deviceIdHash,
      label: input.label,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id_hash" },
  );

  const isNew = !existing && (count ?? 0) > 0;
  return { isNew };
}

export async function clearLoginFailures(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("profiles").update({ locked_until: null }).eq("id", userId);
}
