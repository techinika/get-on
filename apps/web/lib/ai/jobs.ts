import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

export type AiJobMode = "monthly" | "expire" | "payloads" | "all";

export type AiJobResult = {
  monthly: number;
  expired: number;
  payloads: number;
  failed: number;
};

export function monthlyPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthlyExpiry(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1) - 1,
  ).toISOString();
}

export async function grantMonthlyCredits(
  admin: Admin,
  now = new Date(),
): Promise<{ processed: number; failed: number }> {
  const period = monthlyPeriod(now);
  const expires = monthlyExpiry(now);

  const [{ data: plans }, { data: teams }] = await Promise.all([
    admin.from("plans").select("id, ai_monthly_credits"),
    admin.from("teams").select("id, plan_id").neq("plan_id", "free"),
  ]);

  const amountByPlan = new Map(
    (plans ?? []).map((plan) => [
      String(plan.id),
      Number(plan.ai_monthly_credits ?? 0),
    ]),
  );

  let processed = 0;
  let failed = 0;
  for (const team of teams ?? []) {
    const amount = amountByPlan.get(String(team.plan_id)) ?? 0;
    if (amount <= 0) continue;
    const { error } = await admin.rpc("grant_credits", {
      p_team: team.id,
      p_kind: "monthly",
      p_amount: amount,
      p_expires: expires,
      p_source: `monthly:${period}`,
      p_note: "Monthly AI credits",
    });
    if (error) {
      failed += 1;
      console.error(`[ai] monthly grant failed for ${team.id}`, error);
    } else {
      processed += 1;
    }
  }

  return { processed, failed };
}

export async function expireCredits(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("expire_credits");
  if (error) {
    console.error("[ai] expire credits failed", error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function purgePayloads(admin: Admin): Promise<number> {
  const { data, error } = await admin
    .from("ai_payloads")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("request_id");
  if (error) {
    console.error("[ai] payload purge failed", error);
    return 0;
  }
  return data?.length ?? 0;
}

export async function runAiJobs(
  admin: Admin,
  mode: AiJobMode = "all",
  now = new Date(),
): Promise<AiJobResult> {
  const result: AiJobResult = {
    monthly: 0,
    expired: 0,
    payloads: 0,
    failed: 0,
  };

  if (mode === "monthly" || mode === "all") {
    const monthly = await grantMonthlyCredits(admin, now);
    result.monthly = monthly.processed;
    result.failed += monthly.failed;
  }
  if (mode === "expire" || mode === "all") {
    result.expired = await expireCredits(admin);
  }
  if (mode === "payloads" || mode === "all") {
    result.payloads = await purgePayloads(admin);
  }

  return result;
}
