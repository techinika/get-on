import type { StaffAction } from "@get-on/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireStaffAction, StaffError, type StaffSession } from "./staff";

/** Read and write helpers for the remaining staff screens. Metadata only. */

export type AdminDomainList = {
  domains: Record<string, unknown>[];
  hostnames: Record<string, unknown>[];
};

export type AdminDomainEvent = {
  id: string;
  hostname_id: string | null;
  event: string;
  summary: string;
  created_at: string;
};

export type AdminDomainTarget = {
  id: string;
  name: string;
  teamName: string;
};

export type AdminDomainDetail = {
  domain: Record<string, unknown>;
  hostnames: Record<string, unknown>[];
  events: AdminDomainEvent[];
  targets: AdminDomainTarget[];
};

export type AdminBillingSettings = {
  default_currency: string;
  grace_days: number;
  reminder_days: number[];
  invoice_expiry_days: number;
  max_unpaid_invoices: number;
  tax_rate_bps: number;
  pesapal_ipn_id: string | null;
};

export type AdminBillingTerm = {
  months: number;
  discount_bps: number;
  label: string;
  active: boolean;
  sort: number;
};

export type AdminCoupon = {
  id: string;
  code: string;
  active: boolean;
  percent_off_bps: number | null;
  amount_off_cents: number | null;
  plan_ids: string[] | null;
  min_months: number | null;
  max_redemptions: number | null;
};

export type AdminGrant = {
  id: string;
  team_id: string;
  plan_id: string;
  starts_at: string;
  ends_at: string | null;
  source: string;
  note: string | null;
};

export type AdminTeamRef = { id: string; name: string; plan_id: string };
export type AdminPlanRef = { id: string; name: string };

export type AdminReviewItem = {
  id: string;
  team_id: string;
  invoice_id: string | null;
  kind: string;
  details: unknown;
  created_at: string;
};

export type AdminInvoice = {
  id: string;
  team_id: string;
  number: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  expires_at: string | null;
};

export type AdminPayment = {
  id: string;
  team_id: string;
  invoice_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  method: string | null;
  paid_at: string | null;
};

export type AdminBillingOverview = {
  settings: AdminBillingSettings | null;
  terms: AdminBillingTerm[];
  coupons: AdminCoupon[];
  grants: AdminGrant[];
  teams: AdminTeamRef[];
  plans: AdminPlanRef[];
  reviews: AdminReviewItem[];
  invoices: AdminInvoice[];
  payments: AdminPayment[];
};

export type AdminAiModel = {
  id: string;
  model_id: string | null;
  purposes: unknown[] | null;
  supports_json: boolean | null;
  supports_vision: boolean | null;
  fallback_id: string | null;
  enabled: boolean | null;
};

export type AdminAiDay = {
  day: string;
  credits: number;
  neurons: number;
  requests: number;
};

export type AdminAiSettings = {
  enabled: boolean;
  creditNeurons: number;
  dailyCapCredits: number;
  freeGrantCredits: number;
  maxPromptChars: number;
  moderationEnabled: boolean;
  imagesEnabled: boolean;
  payloadRetentionDays: number;
  gatewayId: string | null;
  defaultLanguage: string;
};

export type AdminAiOverview = {
  settings: AdminAiSettings;
  models: AdminAiModel[];
  daily: AdminAiDay[];
  failures: number;
  requests7d: number;
};

export type AdminAiDesignOverview = {
  checks: number;
  average: number;
  unmet: number;
  unsupported: number;
  applied: number;
  archetypes: { name: string; total: number; accuracy: number }[];
};

export type AdminReferralSettings = {
  enabled: boolean;
  qualify_hours: number;
  monthly_cap: number;
  referred_bonus_credits: number;
  velocity_hold_per_day: number;
};

export type AdminReferral = {
  id: string;
  referrer_user_id: string;
  referee_user_id: string;
  referrer_email: string | null;
  referee_email: string | null;
  source: string;
  status: string;
  reason: string | null;
  qualified_at: string | null;
  created_at: string;
};

export type AdminReferralReward = {
  id: string;
  user_email: string | null;
  milestone: number;
  reward_type: string;
  amount: number;
  status: string;
  claim_status: string;
  created_at: string;
  claimed_at: string | null;
};

export type AdminReferrals = {
  settings: AdminReferralSettings | null;
  referrals: AdminReferral[];
  rewards: AdminReferralReward[];
};

export type AdminSiteAudit = {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  staff_name: string;
};

export type AdminSiteReport = {
  id: string;
  reason: string;
  status: string;
  details: string | null;
  reporter_email: string | null;
  created_at: string;
  handled_at: string | null;
};

export type AdminSiteFlag = {
  id: string;
  kind: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminSitePublish = {
  id: string;
  status: string;
  pages_count: number | null;
  error_code: string | null;
  created_at: string;
  live_at: string | null;
};

export type AdminSiteDetail = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  review_state: string;
  review_requested_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  team_id: string;
  team_name: string;
  owner_email: string | null;
  plan_id: string;
  pages: number;
  publishes: AdminSitePublish[];
  reports: AdminSiteReport[];
  flags: AdminSiteFlag[];
  audit: AdminSiteAudit[];
};

const DEFAULT_AI_SETTINGS: AdminAiSettings = {
  enabled: true,
  creditNeurons: 100,
  dailyCapCredits: 5000,
  freeGrantCredits: 25,
  maxPromptChars: 20000,
  moderationEnabled: true,
  imagesEnabled: false,
  payloadRetentionDays: 30,
  gatewayId: null,
  defaultLanguage: "en",
};

function numeric(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function aiSettings(value: Record<string, unknown> | null): AdminAiSettings {
  if (!value) return DEFAULT_AI_SETTINGS;
  return {
    enabled: value.enabled !== false,
    creditNeurons: numeric(value.credit_neurons, DEFAULT_AI_SETTINGS.creditNeurons),
    dailyCapCredits: numeric(
      value.daily_cap_credits,
      DEFAULT_AI_SETTINGS.dailyCapCredits,
    ),
    freeGrantCredits: numeric(
      value.free_grant_credits,
      DEFAULT_AI_SETTINGS.freeGrantCredits,
    ),
    maxPromptChars: numeric(
      value.max_prompt_chars,
      DEFAULT_AI_SETTINGS.maxPromptChars,
    ),
    moderationEnabled: value.moderation_enabled !== false,
    imagesEnabled: value.images_enabled === true,
    payloadRetentionDays: numeric(
      value.payload_retention_days,
      DEFAULT_AI_SETTINGS.payloadRetentionDays,
    ),
    gatewayId: typeof value.gateway_id === "string" ? value.gateway_id : null,
    defaultLanguage:
      typeof value.default_language === "string"
        ? value.default_language
        : DEFAULT_AI_SETTINGS.defaultLanguage,
  };
}

export async function getAdminDomains(): Promise<AdminDomainList> {
  return rpc<AdminDomainList>("admin_domains", {});
}

export async function getAdminDomain(
  domainId: string,
): Promise<AdminDomainDetail | null> {
  return rpc<AdminDomainDetail | null>("admin_domain", { p_domain_id: domainId });
}

export async function getBillingOverview(): Promise<AdminBillingOverview> {
  return rpc<AdminBillingOverview>("admin_billing_overview", {});
}

export async function saveBillingSettings(input: {
  currency: string;
  graceDays: number;
  reminderDays: number[];
  invoiceExpiryDays: number;
  maxUnpaidInvoices: number;
  taxRateBps: number;
  pesapalIpnId: string | null;
}): Promise<void> {
  await rpc("admin_billing_set_settings", {
    p_currency: input.currency,
    p_grace_days: input.graceDays,
    p_reminder_days: input.reminderDays,
    p_invoice_expiry_days: input.invoiceExpiryDays,
    p_max_unpaid_invoices: input.maxUnpaidInvoices,
    p_tax_rate_bps: input.taxRateBps,
    p_pesapal_ipn_id: input.pesapalIpnId,
  });
}

export async function saveBillingTerm(input: {
  months: number;
  discountBps: number;
  label: string;
  active: boolean;
}): Promise<void> {
  await rpc("admin_billing_set_term", {
    p_months: input.months,
    p_discount_bps: input.discountBps,
    p_label: input.label,
    p_active: input.active,
  });
}

export async function createBillingCoupon(input: {
  code: string;
  percentOffBps: number;
  amountOffCents: number;
  planIds: string[];
  minMonths: number;
  firstPurchaseOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number;
  perTeamLimit: number;
}): Promise<string> {
  const result = await rpc<{ id: string }>("admin_billing_create_coupon", {
    p_code: input.code,
    p_percent_off_bps: input.percentOffBps,
    p_amount_off_cents: input.amountOffCents,
    p_plan_ids: input.planIds,
    p_min_months: input.minMonths,
    p_first_purchase_only: input.firstPurchaseOnly,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_max_redemptions: input.maxRedemptions,
    p_per_team_limit: input.perTeamLimit,
  });
  return result.id;
}

export async function toggleBillingCoupon(id: string, active: boolean): Promise<void> {
  await rpc("admin_billing_toggle_coupon", { p_id: id, p_active: active });
}

export async function createBillingGrant(input: {
  teamId: string;
  planId: string;
  startsAt: string;
  endsAt: string | null;
  note: string;
}): Promise<void> {
  await rpc("admin_billing_create_grant", {
    p_team: input.teamId,
    p_plan: input.planId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_note: input.note,
  });
}

export async function revokeBillingGrant(id: string): Promise<void> {
  await rpc("admin_billing_revoke_grant", { p_id: id });
}

export async function voidBillingInvoice(id: string, reason: string): Promise<void> {
  await rpc("admin_billing_void_invoice", { p_invoice: id, p_reason: reason });
}

export async function resolveBillingReview(id: string): Promise<void> {
  await rpc("admin_billing_resolve_review", { p_id: id });
}

export async function getAiOverview(): Promise<AdminAiOverview> {
  const raw = await rpc<{
    settings: Record<string, unknown> | null;
    models: AdminAiModel[];
    daily: AdminAiDay[];
    failures: number;
    requests_7d: number;
  }>("admin_ai_overview", {});
  return {
    settings: aiSettings(raw.settings),
    models: raw.models,
    daily: raw.daily,
    failures: raw.failures,
    requests7d: raw.requests_7d,
  };
}

export async function saveAiSettings(input: {
  enabled: boolean;
  imagesEnabled: boolean;
  moderationEnabled: boolean;
  creditNeurons: number;
  dailyCapCredits: number;
  freeGrantCredits: number;
  maxPromptChars: number;
  payloadRetentionDays: number;
  gatewayId: string | null;
  defaultLanguage: string;
}): Promise<void> {
  await rpc("admin_ai_save_settings", {
    p_enabled: input.enabled,
    p_images_enabled: input.imagesEnabled,
    p_moderation_enabled: input.moderationEnabled,
    p_credit_neurons: input.creditNeurons,
    p_daily_cap_credits: input.dailyCapCredits,
    p_free_grant_credits: input.freeGrantCredits,
    p_max_prompt_chars: input.maxPromptChars,
    p_payload_retention_days: input.payloadRetentionDays,
    p_gateway_id: input.gatewayId,
    p_default_language: input.defaultLanguage,
  });
}

export async function toggleAiModel(id: string, enabled: boolean): Promise<void> {
  await rpc("admin_ai_toggle_model", { p_model: id, p_enabled: enabled });
}

export async function getAiDesignOverview(): Promise<AdminAiDesignOverview> {
  return rpc<AdminAiDesignOverview>("admin_ai_design_overview", {});
}

export async function getAdminReferrals(): Promise<AdminReferrals> {
  return rpc<AdminReferrals>("admin_referrals", {});
}

export async function saveReferralSettings(input: {
  enabled: boolean;
  qualifyHours: number;
  monthlyCap: number;
  bonusCredits: number;
  velocityHoldPerDay: number;
}): Promise<void> {
  await rpc("admin_referral_settings_update", {
    p_enabled: input.enabled,
    p_qualify_hours: input.qualifyHours,
    p_monthly_cap: input.monthlyCap,
    p_bonus_credits: input.bonusCredits,
    p_velocity_hold_per_day: input.velocityHoldPerDay,
  });
}

export async function setReferralStatus(
  referralId: string,
  status: string,
  reason: string | null,
): Promise<void> {
  await rpc("admin_referral_set_status", {
    p_referral: referralId,
    p_status: status,
    p_reason: reason,
  });
}

export async function getAdminSite(siteId: string): Promise<AdminSiteDetail | null> {
  return rpc<AdminSiteDetail | null>("admin_site_detail", { p_project: siteId });
}

export async function requestSiteReview(siteId: string, reason: string): Promise<void> {
  await rpc("admin_site_request_review", {
    p_project: siteId,
    p_reason: reason,
  });
}

export async function removeSiteReport(reportId: string): Promise<void> {
  await rpc("admin_site_remove_report", { p_report: reportId });
}

export async function requireScreenAction(action: StaffAction): Promise<StaffSession> {
  return requireStaffAction(action);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new StaffError(error.message, error.message);
  return data as T;
}
