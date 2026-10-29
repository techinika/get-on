import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmail } from "@/lib/email/enqueue";
import { teamNoticeEmail } from "@get-on/email";
import env from "@/lib/env";
import { logTeamActivity } from "@/lib/activity/log";

type Admin = SupabaseClient;

export async function markReferralPublished(
  admin: Admin,
  userId: string,
  projectId: string,
): Promise<void> {
  const { data: referral } = await admin
    .from("referrals")
    .select("id, status, published_at")
    .eq("referee_user_id", userId)
    .maybeSingle();
  if (!referral) return;
  if (!["signed_up", "verified", "published", "held"].includes(String(referral.status))) return;
  if (referral.published_at) return;

  const { data: project } = await admin
    .from("projects")
    .select("id, status, deleted_at, team_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.status !== "published" || project.deleted_at) return;

  await admin
    .from("referrals")
    .update({
      published_at: new Date().toISOString(),
      ...(referral.status === "held" ? {} : { status: "published" }),
    })
    .eq("id", referral.id);
}

async function personalTeamId(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();
  return data?.id ?? null;
}

async function awardRefereeBonus(
  admin: Admin,
  referral: { id: string; referee_user_id: string },
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const { data: existing } = await admin
    .from("referral_rewards")
    .select("id")
    .eq("user_id", referral.referee_user_id)
    .eq("milestone", 0)
    .eq("note", `welcome:${referral.id}`)
    .maybeSingle();
  if (existing) return;

  const teamId = await personalTeamId(admin, referral.referee_user_id);
  if (!teamId) return;

  const { error: grantError } = await admin.rpc("grant_credits", {
    p_team: teamId,
    p_kind: "referral",
    p_amount: Math.round(amount),
    p_expires: null,
    p_source: `referral-bonus:${referral.id}`,
    p_note: "Welcome AI credits",
  });
  if (grantError) {
    console.error("[referrals] referee bonus grant failed", grantError);
    return;
  }

  const { data: reward } = await admin
    .from("referral_rewards")
    .insert({
      user_id: referral.referee_user_id,
      team_id: teamId,
      milestone: 0,
      reward_type: "ai_credits",
      amount,
      status: "applied",
      applied_at: new Date().toISOString(),
      claim_status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by: referral.referee_user_id,
      note: `welcome:${referral.id}`,
    })
    .select("id")
    .maybeSingle();
  if (!reward) return;

  await admin.from("referral_reward_events").insert([
    { reward_id: reward.id, user_id: referral.referee_user_id, event: "received", amount, note: "Welcome credits" },
    { reward_id: reward.id, user_id: referral.referee_user_id, event: "claimed", amount, note: "Welcome credits" },
  ]);
}

async function awardLadderRewards(
  admin: Admin,
  referral: { id: string; referrer_user_id: string; referee_user_id: string },
): Promise<number> {
  const { count: qualified } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referral.referrer_user_id)
    .eq("status", "qualified");

  const { data: ladder } = await admin
    .from("referral_ladder")
    .select("id, milestone, reward_type, amount")
    .eq("active", true)
    .lte("milestone", qualified ?? 0)
    .order("milestone", { ascending: true });
  if (!ladder?.length) return 0;

  const teamId = await personalTeamId(admin, referral.referrer_user_id);
  let awarded = 0;
  for (const step of ladder) {
    const { data: existing } = await admin
      .from("referral_rewards")
      .select("id")
      .eq("user_id", referral.referrer_user_id)
      .eq("milestone", step.milestone)
      .eq("reward_type", step.reward_type)
      .maybeSingle();
    if (existing) continue;

    const { data: reward } = await admin
      .from("referral_rewards")
      .insert({
        user_id: referral.referrer_user_id,
        team_id: teamId,
        ladder_id: step.id,
        milestone: step.milestone,
        reward_type: step.reward_type,
        amount: step.amount,
        status: "saved",
        claim_status: "unclaimed",
        note: `ladder:${step.milestone}:${step.reward_type}`,
      })
      .select("id")
      .maybeSingle();
    if (!reward) continue;
    await admin.from("referral_reward_events").insert({
      reward_id: reward.id,
      user_id: referral.referrer_user_id,
      event: "received",
      amount: step.amount,
      note: `Reached ${step.milestone} friends`,
    });
    awarded += 1;
  }
  return awarded;
}

export async function qualifyDueReferrals(
  admin: Admin,
  now = new Date(),
): Promise<{ qualified: number; failed: number }> {
  const { data: settings } = await admin
    .from("referral_settings")
    .select("qualify_hours, enabled")
    .eq("id", 1)
    .maybeSingle();
  if (settings && settings.enabled === false) return { qualified: 0, failed: 0 };
  const hours = Number(settings?.qualify_hours ?? 24);
  const cutoff = new Date(now.getTime() - hours * 3600_000).toISOString();

  const { data: referrals } = await admin
    .from("referrals")
    .select("id, referrer_user_id, referee_user_id, status, published_at")
    .eq("status", "published")
    .lte("published_at", cutoff)
    .limit(100);

  let qualified = 0;
  let failed = 0;
  for (const referral of referrals ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(referral.referee_user_id);
    if (!authUser?.user?.email_confirmed_at) continue;

    const { data: membership } = await admin
      .from("team_members")
      .select("team_id")
      .eq("user_id", referral.referee_user_id)
      .eq("status", "active");
    const teamIds = (membership ?? []).map((row) => row.team_id);
    if (teamIds.length === 0) continue;

    const { data: published } = await admin
      .from("projects")
      .select("id")
      .in("team_id", teamIds)
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (!published) continue;

    const { error } = await admin
      .from("referrals")
      .update({ status: "qualified", qualified_at: now.toISOString() })
      .eq("id", referral.id)
      .eq("status", "published");
    if (error) {
      failed += 1;
      continue;
    }

    try {
      const { data: freshSettings } = await admin
        .from("referral_settings")
        .select("referred_bonus_credits")
        .eq("id", 1)
        .maybeSingle();
      await awardRefereeBonus(admin, referral, Number(freshSettings?.referred_bonus_credits ?? 10));
      const awarded = await awardLadderRewards(admin, referral);
      qualified += 1;

      const referrerTeam = await personalTeamId(admin, referral.referrer_user_id);
      if (referrerTeam) {
        await logTeamActivity({
          teamId: referrerTeam,
          actor: { userId: referral.referee_user_id },
          event: "referral_qualified",
          summary: "A friend published their first website, so a referral counted",
          target: { type: "referral", id: referral.id },
        }).catch(() => undefined);
      }

      if (awarded > 0) {
        const { data: profile } = await admin
          .from("profiles")
          .select("email")
          .eq("id", referral.referrer_user_id)
          .maybeSingle();
        if (profile?.email) {
          const base = (env.siteUrl || env.appOrigin || "https://get-on.tech").replace(/\/$/, "");
          const mail = teamNoticeEmail({
            title: awarded === 1 ? "A referral reward is ready" : `${awarded} referral rewards are ready`,
            intro: "A friend published their first website. Open Invite and earn to claim your reward.",
            actionUrl: `${base}/dashboard/invite`,
            actionLabel: "See my rewards",
            footer: "You choose when to claim each reward.",
          });
          await enqueueEmail({
            kind: "referral_reward",
            toEmail: profile.email,
            relatedType: "referral",
            relatedId: referral.id,
            dedupeKey: `referral:${referral.id}:${referral.referrer_user_id}`,
            payload: {
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
            },
          }).catch((error) => console.error("[referrals] reward email failed", error));
        }
      }
    } catch (error) {
      console.error("[referrals] reward failed", error);
      failed += 1;
    }
  }

  return { qualified, failed };
}
