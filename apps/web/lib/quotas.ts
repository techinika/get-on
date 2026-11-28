import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { planLimits, type PlanId } from "@/lib/plans";

export type QuotaUsage = {
  active_sites: number;
  deleted_pending: number;
  max_websites: number | null;
  max_members: number | null;
  max_deleted_pending: number;
};

function parseNullableLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }
  return null;
}

export function normalizeQuotaRow(raw: unknown): QuotaUsage | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  return {
    active_sites: Math.max(0, Number(rec.active_sites ?? 0) || 0),
    deleted_pending: Math.max(0, Number(rec.deleted_pending ?? 0) || 0),
    max_websites: parseNullableLimit(rec.max_websites),
    max_members: parseNullableLimit(rec.max_members),
    max_deleted_pending: Math.max(0, Number(rec.max_deleted_pending ?? 0) || 0),
  };
}

export function reconcileQuotaWithPlan(
  quota: QuotaUsage | null,
  planId: PlanId | string,
  fallbackActiveSites = 0,
): QuotaUsage {
  const plan = planLimits(planId);
  return {
    active_sites: quota ? quota.active_sites : Math.max(0, fallbackActiveSites),
    deleted_pending: quota ? quota.deleted_pending : 0,
    max_websites: plan.maxWebsites === null ? null : plan.maxWebsites,
    max_members: plan.maxMembers === null ? null : plan.maxMembers,
    max_deleted_pending: quota ? quota.max_deleted_pending : 0,
  };
}

export async function resolveEffectiveQuota(
  client: SupabaseClient,
  teamId: string,
  planId: PlanId | string,
): Promise<QuotaUsage> {
  const { data } = await client.rpc("team_quota_usage", { p_team: teamId });
  const normalized = normalizeQuotaRow(data);
  if (normalized) {
    return reconcileQuotaWithPlan(normalized, planId);
  }
  const { count } = await client
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("deleted_at", null);
  return reconcileQuotaWithPlan(null, planId, count ?? 0);
}

export const getQuota = cache(async (teamId: string): Promise<QuotaUsage | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_quota_usage", { p_team: teamId });
  return normalizeQuotaRow(data);
});
