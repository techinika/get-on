import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

export type ReferralSource = "link" | "code" | "badge";

function salt(): string {
  return process.env.REFERRAL_HASH_SALT ?? process.env.IP_HASH_SALT ?? "dev-referral-salt-change-me";
}

export function hashReferralValue(value: string): string {
  return createHash("sha256").update(`${salt()}:${value.trim().toLowerCase()}`).digest("hex");
}

export function normalizeReferralCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export type AttributionResult =
  | { ok: true; status: "signed_up" | "held" | "ignored" }
  | { ok: false; reason: string };

export async function attributeReferral(input: {
  admin: Admin;
  userId: string;
  email: string;
  code: string | null;
  ip: string | null;
  userAgent: string | null;
  source?: ReferralSource;
}): Promise<AttributionResult> {
  const code = normalizeReferralCode(input.code);
  if (!code) return { ok: false, reason: "NO_CODE" };

  const email = input.email.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const [{ data: disposable }, { data: settings }] = await Promise.all([
    input.admin.from("disposable_email_domains").select("domain").eq("domain", domain).maybeSingle(),
    input.admin.from("referral_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (disposable) return { ok: false, reason: "DISPOSABLE_EMAIL" };
  if (settings && settings.enabled === false) return { ok: false, reason: "DISABLED" };

  let referrerId: string | null = null;
  const { data: byCode } = await input.admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  referrerId = byCode?.id ?? null;

  if (!referrerId) {
    const { data: site } = await input.admin
      .from("projects")
      .select("team_id, teams(owner_id)")
      .eq("subdomain", code.toLowerCase())
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    const owner = (site as { teams?: { owner_id?: string } } | null)?.teams?.owner_id;
    referrerId = owner ?? null;
  }
  if (!referrerId) return { ok: false, reason: "CODE_NOT_FOUND" };
  if (referrerId === input.userId) return { ok: false, reason: "SELF" };

  const { data: existing } = await input.admin
    .from("referrals")
    .select("id")
    .eq("referee_user_id", input.userId)
    .maybeSingle();
  if (existing) return { ok: true, status: "ignored" };

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const [{ count: monthCount }, { count: dayCount }] = await Promise.all([
    input.admin.from("referrals").select("id", { count: "exact", head: true })
      .eq("referrer_user_id", referrerId).gte("created_at", monthStart.toISOString()),
    input.admin.from("referrals").select("id", { count: "exact", head: true })
      .eq("referrer_user_id", referrerId).gte("created_at", dayAgo),
  ]);

  const cap = Number(settings?.monthly_cap ?? 50);
  const velocity = Number(settings?.velocity_hold_per_day ?? 5);
  let status: "signed_up" | "held" = "signed_up";
  let reason: string | null = null;
  if ((monthCount ?? 0) >= cap) {
    status = "held";
    reason = "MONTHLY_CAP";
  } else if ((dayCount ?? 0) >= velocity) {
    status = "held";
    reason = "VELOCITY";
  }

  const { error } = await input.admin.from("referrals").insert({
    referrer_user_id: referrerId,
    referee_user_id: input.userId,
    source: input.source ?? "link",
    status,
    reason,
    ip_hash: input.ip ? hashReferralValue(input.ip) : null,
    ua_hash: input.userAgent ? hashReferralValue(input.userAgent) : null,
    email_base_hash: hashReferralValue(email),
  });
  if (error) return { ok: false, reason: "SAVE_FAILED" };

  await input.admin
    .from("profiles")
    .update({ referred_by: referrerId, referred_at: new Date().toISOString() })
    .eq("id", input.userId)
    .is("referred_by", null);

  return { ok: true, status };
}
