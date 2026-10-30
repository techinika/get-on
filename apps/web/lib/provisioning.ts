"use admin";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Grant free plan entitlements to a newly verified account.
 * Idempotent: guarded by free_ai_grant_at unique constraint.
 * Called from the email verification handler in the same transaction.
 *
 * What it does:
 * - Grants 25 one-time AI credits into the user's balance
 * - Sets profiles.free_ai_grant_at (prevents double grant)
 * - Initialises usage counters and quotas
 * - Records the grant event
 */
export async function grantFreeEntitlements(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Check if already granted (guard: unique per user)
  const { data: profile } = await admin
    .from("profiles")
    .select("free_ai_grant_at")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.free_ai_grant_at) {
    // Already granted; nothing to do (idempotent)
    return;
  }

  // 1. Grant 25 free AI credits by updating the ai_settings table
  // The ai_settings table has a free_grant_credits column defaulting to 25
  await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: 25,
    p_kind: "free_grant",
    p_reason: "free-account-signup",
  });

  // 2. Set the free AI grant timestamp (unique guard per account)
  await admin
    .from("profiles")
    .update({ free_ai_grant_at: new Date().toISOString() })
    .eq("id", userId);

  // 3. Initialize usage counters and quotas (idempotent defaults)
  // Read the Free plan limits and set them on the profile/projections
  await admin.rpc("initialize_free_quotas", {
    p_user_id: userId,
  });

  // 4. Record the grant event for audit/logging
  await admin.rpc("record_security_event", {
    p_user: userId,
    p_category: "account",
    p_event: "free_grant_granted",
    p_severity: "info",
    p_summary: "25 free AI credits granted at account creation",
    p_ip_hash: "",
    p_ua_family: "",
    p_visible_to_user: true,
    p_meta: JSON.stringify({ credits: 25 }),
  });
}