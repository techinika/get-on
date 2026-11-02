"use admin";

import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFreeGrant, loadAiSettings } from "@/lib/ai/settings";
import { recordSecurityEvent } from "@/lib/security/events";

/**
 * Grant free plan entitlements to a newly verified account.
 * Idempotent: guarded by profiles.free_ai_grant_at.
 * Called after the email verification handler has created the session.
 */
export async function grantFreeEntitlements(userId: string): Promise<void> {
  const admin = createAdminClient();
  const settings = await loadAiSettings(admin);

  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();

  if (teamError || !team) {
    console.error("[provisioning] personal team not found", teamError ?? userId);
    return;
  }

  let granted = false;
  try {
    granted = await ensureFreeGrant(
      admin,
      String(team.id),
      userId,
      settings.freeGrantCredits,
    );
  } catch (error) {
    console.error("[provisioning] free AI grant failed", error);
    return;
  }

  if (!granted) return;

  await recordSecurityEvent({
    userId,
    teamId: String(team.id),
    category: "account",
    event: "free_grant_granted",
    severity: "info",
    summary: `${settings.freeGrantCredits} free AI credits granted at account creation`,
    visibleToUser: true,
    meta: { credits: settings.freeGrantCredits },
  });
}
