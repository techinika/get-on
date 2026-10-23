import type { PlanId } from "@/lib/plans";

export const DAILY_CAPS: Record<PlanId, number> = {
  free: 20,
  basic: 100,
  pro: 300,
  enterprise: 1000,
};

export type RateDecision =
  | { ok: true }
  | { ok: false; code: "rate" | "closed" };

import type { SupabaseClient } from "@supabase/supabase-js";

type AdminLike = SupabaseClient;

/** Short-window and daily limits for one visitor, then the plan's daily cap. */
export async function checkSubmissionRate(
  admin: AdminLike,
  input: { projectId: string; ipHash: string; planId: PlanId },
): Promise<RateDecision> {
  const now = Date.now();
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: shortCount }, { count: dayCount }, { count: accepted }] = await Promise.all([
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.projectId)
      .eq("ip_hash", input.ipHash)
      .gte("created_at", tenMinutesAgo),
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.projectId)
      .eq("ip_hash", input.ipHash)
      .gte("created_at", dayAgo),
    admin
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.projectId)
      .neq("status", "spam")
      .gte("created_at", dayAgo),
  ]);

  if ((shortCount ?? 0) >= 5 || (dayCount ?? 0) >= 15) {
    return { ok: false, code: "rate" };
  }

  if ((accepted ?? 0) >= DAILY_CAPS[input.planId]) {
    return { ok: false, code: "closed" };
  }

  return { ok: true };
}

/** The same email and message within 24 hours is treated as a double send. */
export async function isDuplicate(
  admin: AdminLike,
  input: { projectId: string; email: string; message: string },
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("contact_messages")
    .select("id, message")
    .eq("project_id", input.projectId)
    .eq("email", input.email)
    .gte("created_at", since)
    .limit(20);

  const wanted = input.message.replace(/\s+/g, " ").trim().toLowerCase();
  return (data ?? []).some((row: { message: string }) =>
    String(row.message).replace(/\s+/g, " ").trim().toLowerCase() === wanted,
  );
}
