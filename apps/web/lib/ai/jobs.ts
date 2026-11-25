import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_BY_ID, type PlanId } from "@/lib/plans";

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

function resolveMonthlyAmount(
  planId: string,
  amountByPlan: Map<string, number>,
): number {
  const configured = amountByPlan.get(planId) ?? 0;
  if (configured > 0) return configured;
  if (planId === "free") return 0;
  return PLAN_BY_ID[planId as PlanId]?.aiMonthlyCredits ?? 0;
}

export async function ensureTeamMonthlyCredits(
  admin: Admin,
  teamId: string,
  options?: { planId?: string; status?: string; now?: Date },
): Promise<{ granted: boolean; amount: number }> {
  const now = options?.now ?? new Date();
  let planId = options?.planId;
  let status = options?.status;

  if (!planId || !status) {
    const { data: access, error } = await admin.rpc("billing_resolve_team", {
      p_team: teamId,
    });
    if (error || !access || typeof access !== "object") {
      return { granted: false, amount: 0 };
    }
    const row = access as { plan_id?: string; status?: string };
    planId = planId ?? String(row.plan_id ?? "free");
    status = status ?? String(row.status ?? "free");
  }

  if (status === "lapsed" || planId === "free") {
    return { granted: false, amount: 0 };
  }

  const period = monthlyPeriod(now);
  const source = `monthly:${period}`;

  const existing = await admin
    .from("credit_buckets")
    .select("id")
    .eq("team_id", teamId)
    .eq("source", source)
    .limit(1)
    .maybeSingle();
  if (!existing.error && existing.data) {
    return { granted: false, amount: 0 };
  }

  const { data: planRow } = await admin
    .from("plans")
    .select("ai_monthly_credits")
    .eq("id", planId)
    .maybeSingle();
  const dbAmount = Number(planRow?.ai_monthly_credits ?? 0);
  const amount =
    dbAmount > 0 ? dbAmount : PLAN_BY_ID[planId as PlanId]?.aiMonthlyCredits ?? 0;
  if (amount <= 0) {
    return { granted: false, amount: 0 };
  }

  const { error: grantError } = await admin.rpc("grant_credits", {
    p_team: teamId,
    p_kind: "monthly",
    p_amount: amount,
    p_expires: monthlyExpiry(now),
    p_source: source,
    p_note: "Monthly AI credits",
  });
  if (grantError) {
    console.error(`[ai] monthly ensure failed for ${teamId}`, grantError);
    return { granted: false, amount: 0 };
  }
  return { granted: true, amount };
}

export async function grantMonthlyCredits(
  admin: Admin,
  now = new Date(),
): Promise<{ processed: number; failed: number }> {
  const period = monthlyPeriod(now);
  const expires = monthlyExpiry(now);

  const [{ data: plans }, { data: teams }] = await Promise.all([
    admin.from("plans").select("id, ai_monthly_credits"),
    admin.from("teams").select("id"),
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
    const { data: access, error: accessError } = await admin.rpc(
      "billing_resolve_team",
      { p_team: team.id },
    );
    if (accessError) {
      failed += 1;
      console.error(`[ai] monthly plan lookup failed for ${team.id}`, accessError);
      continue;
    }
    const resolved = access as { plan_id?: string; status?: string } | null;
    if (resolved?.status === "lapsed") continue;
    const planId = String(resolved?.plan_id ?? "free");
    const amount = resolveMonthlyAmount(planId, amountByPlan);
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
