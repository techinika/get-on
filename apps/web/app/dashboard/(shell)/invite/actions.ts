"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logTeamActivity } from "@/lib/activity/log";

export type ClaimResult = { ok: boolean; error?: string; message?: string };

export async function claimReferralReward(rewardId: string): Promise<ClaimResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const { data: reward } = await supabase
    .from("referral_rewards")
    .select("id, user_id, team_id, reward_type, amount, claim_status, status")
    .eq("id", rewardId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!reward) return { ok: false, error: "We could not find that reward." };
  if (reward.claim_status === "claimed") return { ok: true, message: "This reward is already yours." };
  if (reward.claim_status === "revoked") return { ok: false, error: "This reward is no longer available." };

  let teamId = reward.team_id as string | null;
  if (!teamId) {
    const { data: personal } = await supabase
      .from("teams")
      .select("id")
      .eq("owner_id", user.id)
      .eq("is_personal", true)
      .maybeSingle();
    teamId = personal?.id ?? null;
  }

  if (reward.reward_type === "ai_credits") {
    if (!teamId) return { ok: false, error: "We could not find where to add your credits." };
    const admin = createAdminClient();
    const { error } = await admin.rpc("grant_credits", {
      p_team: teamId,
      p_kind: "referral",
      p_amount: Math.round(Number(reward.amount ?? 0)),
      p_expires: null,
      p_source: `referral:${reward.id}`,
      p_note: "Referral reward",
    });
    if (error) {
      console.error("[referrals] credit grant failed", error);
      return { ok: false, error: "We could not add your credits. Please try again." };
    }
  }

  const { error } = await supabase.rpc("claim_referral_reward", { p_reward: rewardId });
  if (error) {
    console.error("[referrals] claim failed", error);
    return { ok: false, error: "We could not save your claim. Please try again." };
  }

  if (teamId) {
    await logTeamActivity({
      teamId,
      actor: { userId: user.id },
      event: "referral_reward_claimed",
      summary: `${user.email ?? "Someone"} claimed a referral reward`,
      meta: { rewardId, rewardType: reward.reward_type, amount: reward.amount },
    }).catch(() => undefined);
  }

  revalidatePath("/dashboard/invite");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message:
      reward.reward_type === "ai_credits"
        ? "Your AI credits are ready to use."
        : "Saved. We will apply this to your account.",
  };
}
