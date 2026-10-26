import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { AppPage } from "@/components/app/app-page";
import { PageHeader } from "@/components/app/page-header";
import { AppCard } from "@/components/app/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getShellData } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { relativeTime } from "@/lib/relative-time";
import env from "@/lib/env";
import { CopyLink } from "./copy-link";
import { ClaimButton } from "./claim-button";

type RewardRow = {
  id: string;
  milestone: number;
  reward_type: string;
  amount: number;
  claim_status: string;
  status: string;
  created_at: string;
  claimed_at: string | null;
  note: string | null;
};

type LadderRow = {
  id: string;
  milestone: number;
  reward_type: string;
  amount: number;
  label: string;
};

const TYPE_LABEL: Record<string, string> = {
  ai_credits: "AI credits",
  email_credits: "Extra emails",
  free_month: "Free month",
  ai_bonus_percent: "Extra AI credits every month",
};

function rewardLabel(reward: Pick<RewardRow, "reward_type" | "amount">): string {
  const type = TYPE_LABEL[reward.reward_type] ?? "Reward";
  if (reward.reward_type === "ai_credits") return `${reward.amount} ${type}`;
  if (reward.reward_type === "email_credits") return `${reward.amount.toLocaleString()} ${type.toLowerCase()}`;
  if (reward.reward_type === "free_month") return reward.amount === 1 ? "1 free month" : `${reward.amount} free months`;
  if (reward.reward_type === "ai_bonus_percent") return `+${reward.amount}% ${type.toLowerCase()}`;
  return type;
}

export default async function InviteAndEarnPage() {
  const data = await getShellData();
  if (!data) redirect("/login");
  if (!can(data.currentTeam.role as "owner" | "admin" | "editor" | "viewer", "referral.use")) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: referrals }, { data: ladder }, { data: rewards }, { data: settings }] =
    await Promise.all([
      supabase.from("profiles").select("referral_code").eq("id", data.user.id).maybeSingle(),
      supabase
        .from("referrals")
        .select("id, status, created_at, qualified_at")
        .eq("referrer_user_id", data.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("referral_ladder")
        .select("id, milestone, reward_type, amount, label")
        .eq("active", true)
        .order("sort", { ascending: true }),
      supabase
        .from("referral_rewards")
        .select("id, milestone, reward_type, amount, claim_status, status, created_at, claimed_at, note")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("referral_settings").select("monthly_cap, velocity_hold_per_day").eq("id", 1).maybeSingle(),
    ]);

  const code = (profile?.referral_code as string | null) ?? null;
  const base = (env.siteUrl || env.appOrigin || "https://get-on.tech").replace(/\/$/, "");
  const link = code ? `${base}/signup?ref=${encodeURIComponent(code)}` : "";
  const qualified = (referrals ?? []).filter((row) => row.status === "qualified").length;
  const waiting = (referrals ?? []).filter((row) => ["signed_up", "verified", "published", "held"].includes(row.status)).length;
  const rewardRows = (rewards ?? []) as RewardRow[];
  const unclaimed = rewardRows.filter((reward) => reward.claim_status === "unclaimed");
  const claimed = rewardRows.filter((reward) => reward.claim_status === "claimed");
  const ladderRows = (ladder ?? []) as LadderRow[];
  const nextStep = ladderRows.find((step) => step.milestone > qualified);

  const rewardIds = rewardRows.map((reward) => reward.id);
  const { data: events } = rewardIds.length
    ? await supabase
        .from("referral_reward_events")
        .select("id, reward_id, event, amount, note, created_at")
        .in("reward_id", rewardIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const rewardById = new Map(rewardRows.map((reward) => [reward.id, reward] as const));

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[{ label: data.currentTeam.name, href: "/dashboard" }, { label: "Invite and earn" }]}
        title="Invite and earn"
        description="Invite another business owner to Get-On. When they publish their website, you both get a thank you."
      />

      <div className="flex flex-col gap-6">
        <AppCard className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
              <Gift className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold text-text">Your invite link</h2>
              <p className="mt-1 text-[15px] text-text-muted">
                Share this link with someone who needs a website. Your code is <strong className="text-text">{code ?? "coming soon"}</strong>.
              </p>
              {link ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-surface-muted px-3 py-2 text-[14px] text-text">
                    {link}
                  </code>
                  <CopyLink value={link} />
                </div>
              ) : (
                <p className="mt-3 text-[14px] text-text-muted">Your link will appear here in a moment.</p>
              )}
            </div>
          </div>
        </AppCard>

        <div className="grid gap-4 sm:grid-cols-3">
          <AppCard className="p-4">
            <p className="text-[13px] font-medium text-text-muted">Friends who joined</p>
            <p className="mt-1 text-[26px] font-semibold text-text">{qualified}</p>
          </AppCard>
          <AppCard className="p-4">
            <p className="text-[13px] font-medium text-text-muted">Waiting to publish</p>
            <p className="mt-1 text-[26px] font-semibold text-text">{waiting}</p>
          </AppCard>
          <AppCard className="p-4">
            <p className="text-[13px] font-medium text-text-muted">Rewards ready to claim</p>
            <p className="mt-1 text-[26px] font-semibold text-text">{unclaimed.length}</p>
          </AppCard>
        </div>

        <section>
          <h2 className="mb-2 text-[17px] font-semibold text-text">What you can earn</h2>
          <AppCard className="p-0">
            <ul className="divide-y divide-border">
              {ladderRows.map((step) => {
                const done = qualified >= step.milestone;
                const isNext = nextStep?.id === step.id;
                return (
                  <li key={step.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[15px] font-medium text-text">{step.label}</p>
                      <p className="text-[13px] text-text-muted">
                        {done
                          ? "You reached this step."
                          : isNext
                            ? `${step.milestone - qualified} more ${step.milestone - qualified === 1 ? "friend" : "friends"} to go.`
                            : `At ${step.milestone} friends.`}
                      </p>
                    </div>
                    <Badge variant={done ? "live" : "neutral"}>{done ? "Reached" : `${qualified}/${step.milestone}`}</Badge>
                  </li>
                );
              })}
            </ul>
          </AppCard>
        </section>

        <section>
          <h2 className="mb-2 text-[17px] font-semibold text-text">Rewards to claim</h2>
          <AppCard className="p-0">
            {unclaimed.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing waiting"
                  description="When a friend publishes their first website, your rewards will appear here. You choose when to claim each one."
                  icon={<Gift className="size-8 text-text-muted" />}
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {unclaimed.map((reward) => (
                  <li key={reward.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[15px] font-medium text-text">{rewardLabel(reward)}</p>
                      <p className="text-[13px] text-text-muted">
                        For {reward.milestone} {reward.milestone === 1 ? "friend" : "friends"} · received {relativeTime(reward.created_at)}
                      </p>
                    </div>
                    <ClaimButton rewardId={reward.id} />
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </section>

        <section>
          <h2 className="mb-2 text-[17px] font-semibold text-text">Your reward history</h2>
          <AppCard className="p-0">
            {claimed.length === 0 && (events ?? []).length === 0 ? (
              <p className="p-4 text-[15px] text-text-muted">No rewards yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {claimed.map((reward) => (
                  <div key={reward.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="text-[15px] text-text">{rewardLabel(reward)}</p>
                      <p className="text-[13px] text-text-muted">
                        Claimed {reward.claimed_at ? relativeTime(reward.claimed_at) : ""}
                      </p>
                    </div>
                    <Badge variant="live">Claimed</Badge>
                  </div>
                ))}
                {(events ?? []).length > 0 ? (
                  <div className="px-4 py-3">
                    <p className="mb-2 text-[13px] font-medium text-text-muted">Every change we recorded</p>
                    <ul className="flex flex-col gap-1.5">
                      {(events ?? []).map((event) => {
                        const reward = rewardById.get(event.reward_id);
                        return (
                          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                            <span className="text-text">
                              {event.event === "received" ? "Received" : event.event === "claimed" ? "Claimed" : event.event === "revoked" ? "Removed" : "Expired"}{" "}
                              {reward ? rewardLabel(reward) : "reward"}
                            </span>
                            <time className="text-text-muted" dateTime={event.created_at}>
                              {relativeTime(event.created_at)}
                            </time>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </AppCard>
        </section>

        <AppCard className="p-5">
          <h2 className="text-[17px] font-semibold text-text">How it works</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[15px] text-text-muted">
            <li>Share your link. They create a free account and publish their first website.</li>
            <li>We check that the account is real. Most friends count within a day.</li>
            <li>Rewards appear above. Claim each one when you want it. AI credits are added straight away. Other rewards are saved for you.</li>
          </ol>
          <p className="mt-3 text-[13px] text-text-muted">
            Up to {settings?.monthly_cap ?? 50} friends count each month. If many people join on the same day we check them by hand, so a reward can take a little longer.{" "}
            <Link href="/terms" className="font-semibold text-primary underline underline-offset-[3px]">
              Programme rules
            </Link>
          </p>
        </AppCard>
      </div>
    </AppPage>
  );
}
