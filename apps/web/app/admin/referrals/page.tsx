import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { relativeTime } from "@/lib/relative-time";
import { ReferralSettingsForm } from "./settings-form";
import { StatusForm } from "./status-form";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  const admin = createAdminClient();
  const [{ data: referrals }, { data: rewards }, { data: settings }] = await Promise.all([
    admin
      .from("referrals")
      .select("id, referrer_user_id, referee_user_id, source, status, reason, created_at, qualified_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("referral_rewards")
      .select("id, user_id, milestone, reward_type, amount, status, claim_status, created_at, claimed_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("referral_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const userIds = [
    ...new Set([
      ...(referrals ?? []).map((row) => row.referrer_user_id),
      ...(referrals ?? []).map((row) => row.referee_user_id),
      ...(rewards ?? []).map((row) => row.user_id),
    ]),
  ];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile] as const));
  const qualifiedByUser = new Map<string, number>();
  for (const row of referrals ?? []) {
    if (row.status === "qualified") {
      qualifiedByUser.set(row.referrer_user_id, (qualifiedByUser.get(row.referrer_user_id) ?? 0) + 1);
    }
  }

  const config = settings ?? {
    enabled: true,
    qualify_hours: 24,
    monthly_cap: 50,
    referred_bonus_credits: 10,
    velocity_hold_per_day: 5,
  };

  return (
    <AppPage width="default">
      <PageHeader
        title="Referrals"
        description="Who invited whom, rewards waiting to be claimed, and the programme rules."
        actions={
          <Link href="/admin/teams" className={buttonVariants({ variant: "secondary", size: "md" })}>
            Teams
          </Link>
        }
      />

      <AppCard className="p-5">
        <h2 className="mb-3 text-[17px] font-semibold text-text">Programme settings</h2>
        <ReferralSettingsForm settings={config} />
      </AppCard>

      <section className="mt-8">
        <h2 className="mb-2 text-[17px] font-semibold text-text">Invitations</h2>
        <AppCard className="p-0">
          {(referrals ?? []).length === 0 ? (
            <p className="p-4 text-[15px] text-text-muted">No referrals yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(referrals ?? []).map((referral) => {
                const referrer = profileById.get(referral.referrer_user_id);
                const referee = profileById.get(referral.referee_user_id);
                return (
                  <li key={referral.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] text-text">
                          <strong className="font-semibold">{referrer?.email ?? "Someone"}</strong> invited{" "}
                          <strong className="font-semibold">{referee?.email ?? "someone"}</strong>
                        </p>
                        <p className="text-[13px] text-text-muted">
                          {relativeTime(referral.created_at)} · {referral.source} · {qualifiedByUser.get(referral.referrer_user_id) ?? 0} qualified
                          {referral.reason ? ` · ${referral.reason}` : ""}
                        </p>
                      </div>
                      <Badge variant={referral.status === "qualified" ? "live" : referral.status === "rejected" || referral.status === "revoked" ? "danger" : referral.status === "held" ? "draft" : "neutral"}>
                        {referral.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <StatusForm referralId={referral.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-[17px] font-semibold text-text">Rewards</h2>
        <AppCard className="p-0">
          {(rewards ?? []).length === 0 ? (
            <p className="p-4 text-[15px] text-text-muted">No rewards yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(rewards ?? []).map((reward) => {
                const user = profileById.get(reward.user_id);
                return (
                  <li key={reward.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[14px] text-text">
                        {user?.email ?? "Someone"} · {reward.amount} {reward.reward_type.replaceAll("_", " ")} at {reward.milestone}
                      </p>
                      <p className="text-[13px] text-text-muted">
                        Received {relativeTime(reward.created_at)}
                        {reward.claimed_at ? ` · claimed ${relativeTime(reward.claimed_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={reward.claim_status === "claimed" ? "live" : reward.claim_status === "revoked" ? "danger" : "info"}>
                        {reward.claim_status}
                      </Badge>
                      <Badge variant="neutral">{reward.status}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>
      </section>
    </AppPage>
  );
}
