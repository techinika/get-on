import { streamForKind, type EmailStream } from "./streams";

export type EmailCategory =
  | "auth"
  | "account"
  | "team"
  | "website"
  | "domain"
  | "billing"
  | "ai"
  | "contact"
  | "referral"
  | "demo"
  | "abuse"
  | "staff"
  | "marketing";

export interface EmailKindDefinition {
  kind: string;
  stream: EmailStream;
  category: EmailCategory;
  /** Marketing only: every one of these must be present and true to send. */
  requiresMarketingConsent?: boolean;
}

const transactional = (category: EmailCategory) => ({
  stream: "transactional" as const,
  category,
});

/**
 * Every platform email kind. `kind` is what lands in email_log and the outbox,
 * so the catalogue is the single place that decides the stream.
 */
export const EMAIL_CATALOGUE: Record<string, EmailKindDefinition> = {
  auth: { ...transactional("auth"), kind: "auth" },
  password_reset: { ...transactional("auth"), kind: "password_reset" },
  email_verification: { ...transactional("auth"), kind: "email_verification" },
  magic_link: { ...transactional("auth"), kind: "magic_link" },

  account_welcome: { ...transactional("account"), kind: "account_welcome" },
  account_password_changed: { ...transactional("account"), kind: "account_password_changed" },
  account_email_change_requested: {
    ...transactional("account"),
    kind: "account_email_change_requested",
  },
  account_email_changed: { ...transactional("account"), kind: "account_email_changed" },
  account_mfa_changed: { ...transactional("account"), kind: "account_mfa_changed" },
  account_deleted: { ...transactional("account"), kind: "account_deleted" },

  team_invite: { ...transactional("team"), kind: "team_invite" },
  team_invite_reminder: { ...transactional("team"), kind: "team_invite_reminder" },
  invite_accepted: { ...transactional("team"), kind: "invite_accepted" },
  invite_declined: { ...transactional("team"), kind: "invite_declined" },
  member_removed: { ...transactional("team"), kind: "member_removed" },
  member_role_changed: { ...transactional("team"), kind: "member_role_changed" },
  team_member_joined: { ...transactional("team"), kind: "team_member_joined" },
  team_member_left: { ...transactional("team"), kind: "team_member_left" },
  team_ownership_transferred: {
    ...transactional("team"),
    kind: "team_ownership_transferred",
  },
  seats_paused: { ...transactional("team"), kind: "seats_paused" },

  website_transfer: { ...transactional("website"), kind: "website_transfer" },
  website_created: { ...transactional("website"), kind: "website_created" },
  website_first_published: {
    ...transactional("website"),
    kind: "website_first_published",
  },
  website_publish_failed: { ...transactional("website"), kind: "website_publish_failed" },
  website_unpublished: { ...transactional("website"), kind: "website_unpublished" },
  website_deleted: { ...transactional("website"), kind: "website_deleted" },
  website_restored: { ...transactional("website"), kind: "website_restored" },
  website_purge_warning: { ...transactional("website"), kind: "website_purge_warning" },
  website_purged: { ...transactional("website"), kind: "website_purged" },
  website_suspended: { ...transactional("website"), kind: "website_suspended" },
  website_unsuspended: { ...transactional("website"), kind: "website_unsuspended" },
  website_review_approved: {
    ...transactional("website"),
    kind: "website_review_approved",
  },
  website_review_rejected: {
    ...transactional("website"),
    kind: "website_review_rejected",
  },
  website_review_required: {
    ...transactional("website"),
    kind: "website_review_required",
  },
  website_plan_paused: { ...transactional("website"), kind: "website_plan_paused" },
  website_import_done: { ...transactional("website"), kind: "website_import_done" },
  website_backup_failed: { ...transactional("website"), kind: "website_backup_failed" },
  website_form_limit_reached: {
    ...transactional("website"),
    kind: "website_form_limit_reached",
  },

  domain_live: { ...transactional("domain"), kind: "domain_live" },
  domain_attention: { ...transactional("domain"), kind: "domain_attention" },
  domain_stalled: { ...transactional("domain"), kind: "domain_stalled" },
  domain_expiring: { ...transactional("domain"), kind: "domain_expiring" },
  domain_plan_lapsed: { ...transactional("domain"), kind: "domain_plan_lapsed" },
  domain_plan_restored: { ...transactional("domain"), kind: "domain_plan_restored" },
  domain_removal_notice: { ...transactional("domain"), kind: "domain_removal_notice" },
  domain_claim_lost: { ...transactional("domain"), kind: "domain_claim_lost" },
  domain_review: { ...transactional("domain"), kind: "domain_review" },
  domain_reverify: { ...transactional("domain"), kind: "domain_reverify" },

  billing_receipt: { stream: "billing", category: "billing", kind: "billing_receipt" },
  billing_payment_failed: {
    stream: "billing",
    category: "billing",
    kind: "billing_payment_failed",
  },
  billing_renewal_reminder: {
    stream: "billing",
    category: "billing",
    kind: "billing_renewal_reminder",
  },
  billing_grace_started: {
    stream: "billing",
    category: "billing",
    kind: "billing_grace_started",
  },
  billing_lapsed: { stream: "billing", category: "billing", kind: "billing_lapsed" },
  billing_debt_reminder: {
    stream: "billing",
    category: "billing",
    kind: "billing_debt_reminder",
  },
  billing_invoice_expired: {
    stream: "billing",
    category: "billing",
    kind: "billing_invoice_expired",
  },
  billing_refund: { stream: "billing", category: "billing", kind: "billing_refund" },
  billing_grant: { stream: "billing", category: "billing", kind: "billing_grant" },
  billing_invoice_created: {
    stream: "billing",
    category: "billing",
    kind: "billing_invoice_created",
  },
  billing_invoice_voided: {
    stream: "billing",
    category: "billing",
    kind: "billing_invoice_voided",
  },
  billing_payment_pending: {
    stream: "billing",
    category: "billing",
    kind: "billing_payment_pending",
  },
  billing_payment_reversed: {
    stream: "billing",
    category: "billing",
    kind: "billing_payment_reversed",
  },
  billing_refund_requested: {
    stream: "billing",
    category: "billing",
    kind: "billing_refund_requested",
  },
  billing_refund_completed: {
    stream: "billing",
    category: "billing",
    kind: "billing_refund_completed",
  },
  billing_subscription_extended: {
    stream: "billing",
    category: "billing",
    kind: "billing_subscription_extended",
  },
  billing_grace_reminder: {
    stream: "billing",
    category: "billing",
    kind: "billing_grace_reminder",
  },
  billing_lapsed_reminder: {
    stream: "billing",
    category: "billing",
    kind: "billing_lapsed_reminder",
  },
  billing_plan_restored: {
    stream: "billing",
    category: "billing",
    kind: "billing_plan_restored",
  },
  billing_coupon_assigned: {
    stream: "billing",
    category: "billing",
    kind: "billing_coupon_assigned",
  },
  billing_access_granted: {
    stream: "billing",
    category: "billing",
    kind: "billing_access_granted",
  },
  billing_access_revoked: {
    stream: "billing",
    category: "billing",
    kind: "billing_access_revoked",
  },
  billing_email_verify: {
    stream: "billing",
    category: "billing",
    kind: "billing_email_verify",
  },
  billing_details_changed: {
    stream: "billing",
    category: "billing",
    kind: "billing_details_changed",
  },
  billing_hold: { stream: "billing", category: "billing", kind: "billing_hold" },
  billing_grace_extended: {
    stream: "billing",
    category: "billing",
    kind: "billing_grace_extended",
  },
  credits_added_by_support: {
    stream: "billing",
    category: "billing",
    kind: "credits_added_by_support",
  },

  ai_credits_low: { ...transactional("ai"), kind: "ai_credits_low" },
  ai_credits_added: { ...transactional("ai"), kind: "ai_credits_added" },
  ai_limit_set: { ...transactional("ai"), kind: "ai_limit_set" },

  contact_notification: { ...transactional("contact"), kind: "contact_notification" },
  contact_digest: { ...transactional("contact"), kind: "contact_digest" },
  contact_autoreply: { ...transactional("contact"), kind: "contact_autoreply" },
  recipient_verification: {
    ...transactional("contact"),
    kind: "recipient_verification",
  },

  referral_reward: { ...transactional("referral"), kind: "referral_reward" },
  demo_request_alert: { ...transactional("demo"), kind: "demo_request_alert" },
  demo_request_ack: { ...transactional("demo"), kind: "demo_request_ack" },
  abuse_report_alert: { ...transactional("abuse"), kind: "abuse_report_alert" },

  staff_added: { ...transactional("staff"), kind: "staff_added" },
  staff_role_changed: { ...transactional("staff"), kind: "staff_role_changed" },
  staff_removed: { ...transactional("staff"), kind: "staff_removed" },
  staff_mfa_reset: { ...transactional("staff"), kind: "staff_mfa_reset" },
  staff_security_alert: { ...transactional("staff"), kind: "staff_security_alert" },
  approval_requested: { ...transactional("staff"), kind: "approval_requested" },
  approval_decided: { ...transactional("staff"), kind: "approval_decided" },
  approval_expired: { ...transactional("staff"), kind: "approval_expired" },
  admin_alert: { ...transactional("staff"), kind: "admin_alert" },
  admin_weekly_report: { ...transactional("staff"), kind: "admin_weekly_report" },
  campaign_finished: { ...transactional("staff"), kind: "campaign_finished" },
  campaign_paused_by_guard: {
    ...transactional("staff"),
    kind: "campaign_paused_by_guard",
  },

  marketing_campaign: {
    stream: "marketing",
    category: "marketing",
    kind: "marketing_campaign",
    requiresMarketingConsent: true,
  },
};

export function describeEmailKind(kind: string): EmailKindDefinition {
  return (
    EMAIL_CATALOGUE[kind] ?? {
      kind,
      stream: streamForKind(kind),
      category: "account",
    }
  );
}

export function emailKindUsesConsent(kind: string): boolean {
  return Boolean(describeEmailKind(kind).requiresMarketingConsent);
}
