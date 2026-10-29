import { createAdminClient } from "@/lib/supabase/admin";

export type SessionState = {
  userId: string;
  verifiedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  idleExpiresAt: string;
};

export async function getSessionState(sessionId: string): Promise<SessionState | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("session_security")
    .select("user_id,verified_at,revoked_at,expires_at,idle_expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: String(data.user_id),
    verifiedAt: data.verified_at ? String(data.verified_at) : null,
    revokedAt: data.revoked_at ? String(data.revoked_at) : null,
    expiresAt: String(data.expires_at),
    idleExpiresAt: String(data.idle_expires_at),
  };
}

/** True only when the session is verified, not revoked and inside both lifetimes. */
export async function isSessionUsable(sessionId: string, userId: string): Promise<boolean> {
  const state = await getSessionState(sessionId);
  if (!state || state.userId !== userId) return false;
  if (state.revokedAt || !state.verifiedAt) return false;
  const now = Date.now();
  if (new Date(state.expiresAt).getTime() <= now) return false;
  if (new Date(state.idleExpiresAt).getTime() <= now) return false;
  return true;
}
