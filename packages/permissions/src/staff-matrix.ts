export type StaffRole = "super_admin" | "customer_success";

export const staffRoles: StaffRole[] = ["super_admin", "customer_success"];

export const staffRoleLabels: Record<StaffRole, string> = {
  super_admin: "Super admin",
  customer_success: "Customer success",
};

export const staffActionIds = [
  "staff.view",
  "staff.manage",
  "staff.mfa_reset",
  "staff.audit.view",
  "platform.settings",
  "platform.kill_switches",
  "platform.jobs.view",
  "platform.jobs.retry",
  "platform.incident.manage",
  "account.search",
  "account.view",
  "account.note",
  "account.message",
  "account.export",
  "account.delete.request",
  "account.delete.approve",
  "account.lockout.clear",
  "account.sessions.revoke",
  "account.entitlements.rebuild",
  "access.free.request",
  "access.free.approve",
  "access.free.direct",
  "billing.view",
  "billing.payment_status",
  "billing.invoice.view",
  "billing.invoice.pdf",
  "billing.invoice.resend",
  "billing.receipt.resend",
  "billing.coupon.resend",
  "billing.coupon.clear",
  "billing.invoice.void.request",
  "billing.invoice.void.approve",
  "billing.invoice.void.direct",
  "billing.refund.request",
  "billing.refund.approve",
  "billing.refund.direct",
  "billing.manual_payment.request",
  "billing.manual_payment.approve",
  "billing.manual_payment.direct",
  "billing.credit_adjust.request",
  "billing.credit_adjust.approve",
  "billing.credit_adjust.direct",
  "billing.grace_extend.request",
  "billing.grace_extend.approve",
  "billing.grace_extend.direct",
  "billing.hold.request",
  "billing.hold.approve",
  "billing.hold.direct",
  "billing.price.manage",
  "billing.coupon.create",
  "billing.tax_id.view_full",
  "ai.view",
  "ai.credits.request",
  "ai.credits.approve",
  "ai.credits.direct",
  "ai.limits.request",
  "ai.limits.approve",
  "ai.settings",
  "website.search",
  "website.view",
  "website.flag",
  "website.takedown.request",
  "website.takedown.approve",
  "website.takedown.direct",
  "website.reinstate.request",
  "website.reinstate.approve",
  "website.reinstate.direct",
  "website.moderation.evidence",
  "website.moderation.decide",
  "website.plan_pause.request",
  "website.plan_pause.approve",
  "domain.view",
  "domain.recheck",
  "domain.review.request",
  "domain.review.approve",
  "domain.plan_lapse.request",
  "domain.plan_lapse.approve",
  "domain.remove.request",
  "domain.remove.approve",
  "template.system.manage",
  "email.view",
  "email.resend",
  "email.suppression.manage",
  "email.send_test",
  "marketing.view",
  "marketing.campaign.create",
  "marketing.campaign.send",
  "marketing.campaign.approve",
  "marketing.segment.view",
  "marketing.export",
  "marketing.settings",
  "reports.view",
  "reports.export",
  "finance.view",
  "finance.close",
  "support.case.view",
  "support.case.assign",
  "support.case.close",
  "support.case.reopen",
  "support.case.escalate",
  "support.note.internal",
  "support.kb.manage",
  "support.canned.manage",
  "abuse.view",
  "abuse.decide",
  "demo.view",
  "demo.update",
  "notification.settings",
] as const;

export type StaffAction = (typeof staffActionIds)[number];

export const staffActionLabels: Record<StaffAction, string> = {
  "staff.view": "See the staff team",
  "staff.manage": "Add staff, change roles, remove staff",
  "staff.mfa_reset": "Reset a staff member's authenticator",
  "staff.audit.view": "Read the staff audit log",
  "platform.settings": "Change platform settings",
  "platform.kill_switches": "Use platform kill switches",
  "platform.jobs.view": "See job health and errors",
  "platform.jobs.retry": "Retry a job",
  "platform.incident.manage": "Manage an incident banner",
  "account.search": "Search accounts, teams and websites",
  "account.view": "View account metadata (with a purpose)",
  "account.note": "Write customer notes",
  "account.message": "Message a customer",
  "account.export": "Export account metadata",
  "account.delete.request": "Request account deletion",
  "account.delete.approve": "Approve account deletion",
  "account.lockout.clear": "Clear a sign-in lockout",
  "account.sessions.revoke": "Sign a customer out everywhere",
  "account.entitlements.rebuild": "Rebuild entitlements",
  "access.free.request": "Request free access",
  "access.free.approve": "Approve free access",
  "access.free.direct": "Give free access directly",
  "billing.view": "View billing metadata",
  "billing.payment_status": "Check payment status",
  "billing.invoice.view": "View invoices (masked)",
  "billing.invoice.pdf": "Open invoice PDFs",
  "billing.invoice.resend": "Resend an invoice",
  "billing.receipt.resend": "Resend a receipt",
  "billing.coupon.resend": "Resend a coupon",
  "billing.coupon.clear": "Clear a coupon",
  "billing.invoice.void.request": "Request an invoice void",
  "billing.invoice.void.approve": "Approve an invoice void",
  "billing.invoice.void.direct": "Void an invoice directly",
  "billing.refund.request": "Request a refund",
  "billing.refund.approve": "Approve a refund",
  "billing.refund.direct": "Refund directly",
  "billing.manual_payment.request": "Request a manual payment",
  "billing.manual_payment.approve": "Approve a manual payment",
  "billing.manual_payment.direct": "Record a manual payment directly",
  "billing.credit_adjust.request": "Request a credit adjustment",
  "billing.credit_adjust.approve": "Approve a credit adjustment",
  "billing.credit_adjust.direct": "Adjust credit directly",
  "billing.grace_extend.request": "Request more grace time",
  "billing.grace_extend.approve": "Approve more grace time",
  "billing.grace_extend.direct": "Extend grace directly",
  "billing.hold.request": "Request a billing hold",
  "billing.hold.approve": "Approve a billing hold",
  "billing.hold.direct": "Place a billing hold directly",
  "billing.price.manage": "Change prices and plans",
  "billing.coupon.create": "Create coupons",
  "billing.tax_id.view_full": "See full tax ids",
  "ai.view": "View AI credit summaries",
  "ai.credits.request": "Request AI credits",
  "ai.credits.approve": "Approve AI credits",
  "ai.credits.direct": "Add AI credits directly",
  "ai.limits.request": "Request an AI limit",
  "ai.limits.approve": "Approve an AI limit",
  "ai.settings": "Change AI settings and models",
  "website.search": "Search websites",
  "website.view": "View website metadata (with a purpose)",
  "website.flag": "Flag a website",
  "website.takedown.request": "Request a takedown",
  "website.takedown.approve": "Approve a takedown",
  "website.takedown.direct": "Take a website down directly",
  "website.reinstate.request": "Request reinstatement",
  "website.reinstate.approve": "Approve reinstatement",
  "website.reinstate.direct": "Reinstate a website directly",
  "website.moderation.evidence": "See moderation evidence",
  "website.moderation.decide": "Decide a moderation review",
  "website.plan_pause.request": "Request a plan pause",
  "website.plan_pause.approve": "Approve a plan pause",
  "domain.view": "View domains",
  "domain.recheck": "Re-check a domain now",
  "domain.review.request": "Request a domain review",
  "domain.review.approve": "Approve a domain review",
  "domain.plan_lapse.request": "Request a plan lapse pause",
  "domain.plan_lapse.approve": "Approve a plan lapse pause",
  "domain.remove.request": "Request a domain removal",
  "domain.remove.approve": "Approve a domain removal",
  "template.system.manage": "Manage system templates",
  "email.view": "View email delivery logs",
  "email.resend": "Resend a system email",
  "email.suppression.manage": "Manage the suppression list",
  "email.send_test": "Send a test email",
  "marketing.view": "View marketing campaigns",
  "marketing.campaign.create": "Create a campaign",
  "marketing.campaign.send": "Send a campaign",
  "marketing.campaign.approve": "Approve a campaign",
  "marketing.segment.view": "View segments and counts",
  "marketing.export": "Export marketing data",
  "marketing.settings": "Change marketing settings",
  "reports.view": "View reports",
  "reports.export": "Export reports",
  "finance.view": "View the finance report",
  "finance.close": "Close a finance month",
  "support.case.view": "View support cases",
  "support.case.assign": "Assign a case",
  "support.case.close": "Close a case",
  "support.case.reopen": "Reopen a case",
  "support.case.escalate": "Escalate a case",
  "support.note.internal": "Write internal notes",
  "support.kb.manage": "Manage help articles",
  "support.canned.manage": "Manage canned replies",
  "abuse.view": "View abuse reports",
  "abuse.decide": "Decide an abuse report",
  "demo.view": "View demo requests",
  "demo.update": "Update demo requests",
  "notification.settings": "Change notification settings",
};

const customerSuccessActions = new Set<StaffAction>([
  "staff.view",
  "account.search",
  "account.view",
  "account.note",
  "account.message",
  "account.delete.request",
  "account.lockout.clear",
  "account.sessions.revoke",
  "account.entitlements.rebuild",
  "access.free.request",
  "billing.view",
  "billing.payment_status",
  "billing.invoice.view",
  "billing.invoice.resend",
  "billing.receipt.resend",
  "billing.coupon.resend",
  "billing.coupon.clear",
  "billing.invoice.void.request",
  "billing.refund.request",
  "billing.manual_payment.request",
  "billing.credit_adjust.request",
  "billing.grace_extend.request",
  "billing.hold.request",
  "ai.view",
  "ai.credits.request",
  "ai.limits.request",
  "website.search",
  "website.view",
  "website.flag",
  "website.takedown.request",
  "website.reinstate.request",
  "website.moderation.evidence",
  "website.moderation.decide",
  "website.plan_pause.request",
  "domain.view",
  "domain.recheck",
  "domain.review.request",
  "domain.plan_lapse.request",
  "domain.remove.request",
  "email.view",
  "email.resend",
  "marketing.view",
  "marketing.segment.view",
  "reports.view",
  "support.case.view",
  "support.case.assign",
  "support.case.close",
  "support.case.reopen",
  "support.case.escalate",
  "support.note.internal",
  "support.canned.manage",
  "abuse.view",
  "abuse.decide",
  "demo.view",
  "demo.update",
  "platform.jobs.view",
]);

export const staffMatrix = Object.fromEntries(
  staffActionIds.map((action) => [
    action,
    {
      super_admin: true,
      customer_success: customerSuccessActions.has(action),
    },
  ]),
) as Record<StaffAction, Record<StaffRole, boolean>>;

export function staffCan(role: StaffRole, action: StaffAction): boolean {
  return staffMatrix[action]?.[role] === true;
}

export function staffRequire(role: StaffRole, action: StaffAction): void {
  if (!staffCan(role, action)) {
    const err = new Error("STAFF_NOT_ALLOWED") as Error & { code: string };
    err.code = "STAFF_NOT_ALLOWED";
    throw err;
  }
}

export function isStaffRole(value: unknown): value is StaffRole {
  return value === "super_admin" || value === "customer_success";
}

export const approvalRules = {
  expiryHours: 72,
  maxOpenPerMember: 20,
  reauthMinutes: 15,
  accessSessionMinutes: 60,
  idleMinutes: 30,
  absoluteSessionHours: 8,
  reasonMinChars: 10,
  decisionReasonMinChars: 10,
  thresholds: {
    refundDualUsd: 200,
    manualPaymentDualUsd: 500,
    creditAdjustDual: 100,
    aiCreditsDual: 1000,
    graceExtendDirectDays: 90,
  },
  dualControlKinds: [
    "refund",
    "manual_payment",
    "credit_adjust",
    "ai_credits",
  ] as const,
} as const;

export type ApprovalKind =
  | "refund"
  | "manual_payment"
  | "credit_adjust"
  | "ai_credits"
  | "access_grant"
  | "free_access"
  | "invoice_void"
  | "grace_extend"
  | "billing_hold"
  | "plan_change"
  | "credits_limit"
  | "website_takedown"
  | "website_reinstate"
  | "website_plan_pause"
  | "domain_review"
  | "domain_plan_lapse"
  | "domain_remove"
  | "account_delete"
  | "template_publish";

export function needsDualControl(
  kind: ApprovalKind,
  amount: { usd?: number; credits?: number } = {},
  superAdminCount: number,
): boolean {
  if (kind === "refund") {
    return (amount.usd ?? 0) > approvalRules.thresholds.refundDualUsd;
  }
  if (kind === "manual_payment") {
    return (amount.usd ?? 0) > approvalRules.thresholds.manualPaymentDualUsd;
  }
  if (kind === "credit_adjust") {
    return (amount.usd ?? 0) > approvalRules.thresholds.creditAdjustDual;
  }
  if (kind === "ai_credits") {
    return (amount.credits ?? 0) > approvalRules.thresholds.aiCreditsDual;
  }
  if (
    kind === "access_grant" ||
    kind === "free_access" ||
    kind === "invoice_void" ||
    kind === "billing_hold" ||
    kind === "plan_change" ||
    kind === "account_delete"
  ) {
    return superAdminCount >= 2;
  }
  return false;
}
