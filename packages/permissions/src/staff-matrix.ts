export type StaffRole = "super_admin" | "customer_success";

export const staffRoles: readonly StaffRole[] = ["super_admin", "customer_success"];

export const staffRoleLabels: Record<StaffRole, string> = {
  super_admin: "Super admin",
  customer_success: "Customer success",
};

export const staffActionIds = [
  "account.view",
  "account.note",
  "account.message",
  "support.case.manage",
  "access.free.direct",
  "access.free.request",
  "billing.payment_status",
  "billing.price.manage",
  "billing.coupon.create",
  "billing.refund.request",
  "billing.refund.approve",
  "billing.refund.direct",
  "billing.manual_payment.request",
  "billing.credit_adjust.request",
  "billing.invoice.void.request",
  "billing.invoice.void.direct",
  "billing.plan_change.request",
  "billing.grace.extend",
  "billing.hold.manage",
  "billing.settings.manage",
  "ai.credits.request",
  "ai.credits.direct",
  "ai.limit.request",
  "ai.settings",
  "ai.settings.manage",
  "domain.recheck",
  "domain.review.request",
  "domain.review.approve",
  "domain.remove.request",
  "domain.remove.approve",
  "domain.plan_lapse.approve",
  "website.takedown.direct",
  "website.takedown.request",
  "website.reinstate.direct",
  "website.reinstate.request",
  "website.flag",
  "site.takedown.request",
  "site.reinstate.request",
  "abuse.decide",
  "template.system.manage",
  "email.resend",
  "marketing.settings",
  "marketing.campaign.send",
  "platform.settings",
  "platform.jobs.retry",
  "finance.close",
  "staff.manage",
  "approval.decide",
  "demo.manage",
  "export.run",
  "audit.view",
] as const;

export type StaffAction = (typeof staffActionIds)[number];

export const staffActionLabels: Record<StaffAction, string> = {
  "account.view": "View customer metadata",
  "account.note": "Add support notes",
  "account.message": "Message account owner",
  "support.case.manage": "Manage support cases",
  "access.free.direct": "Grant free access directly",
  "access.free.request": "Request free access grant",
  "billing.payment_status": "Check payment status",
  "billing.price.manage": "Manage plan pricing",
  "billing.coupon.create": "Create coupons",
  "billing.refund.request": "Request refund",
  "billing.refund.approve": "Approve refund",
  "billing.refund.direct": "Issue refund directly",
  "billing.manual_payment.request": "Request manual payment",
  "billing.credit_adjust.request": "Request credit adjustment",
  "billing.invoice.void.request": "Request invoice void",
  "billing.invoice.void.direct": "Void invoice directly",
  "billing.plan_change.request": "Request plan change",
  "billing.grace.extend": "Extend grace period",
  "billing.hold.manage": "Place or release billing hold",
  "billing.settings.manage": "Manage billing settings",
  "ai.credits.request": "Request AI credits",
  "ai.credits.direct": "Grant AI credits directly",
  "ai.limit.request": "Request member AI limit change",
  "ai.settings": "Manage AI settings",
  "ai.settings.manage": "Manage AI settings",
  "domain.recheck": "Run domain operations & rechecks",
  "domain.review.request": "Request domain review decision",
  "domain.review.approve": "Approve domain review decision",
  "domain.remove.request": "Request domain removal",
  "domain.remove.approve": "Approve domain removal",
  "domain.plan_lapse.approve": "Approve domain plan lapse",
  "website.takedown.direct": "Take down website directly",
  "website.takedown.request": "Request website takedown",
  "website.reinstate.direct": "Reinstate website directly",
  "website.reinstate.request": "Request website reinstatement",
  "website.flag": "Flag website for review",
  "site.takedown.request": "Request website takedown",
  "site.reinstate.request": "Request website reinstatement",
  "abuse.decide": "Decide abuse reports",
  "template.system.manage": "Manage system templates",
  "email.resend": "Resend system email",
  "marketing.settings": "Manage marketing settings",
  "marketing.campaign.send": "Send marketing campaigns",
  "platform.settings": "Manage platform settings",
  "platform.jobs.retry": "Retry platform jobs",
  "finance.close": "Close finance period",
  "staff.manage": "Manage platform staff",
  "approval.decide": "Approve or reject staff requests",
  "demo.manage": "Manage demo requests",
  "export.run": "Run platform exports",
  "audit.view": "View staff audit log",
};

const CS_ALLOWED = new Set<StaffAction>([
  "account.view",
  "account.note",
  "account.message",
  "support.case.manage",
  "access.free.request",
  "billing.payment_status",
  "billing.refund.request",
  "billing.manual_payment.request",
  "billing.credit_adjust.request",
  "billing.invoice.void.request",
  "billing.plan_change.request",
  "ai.credits.request",
  "ai.limit.request",
  "domain.recheck",
  "domain.review.request",
  "domain.remove.request",
  "website.takedown.request",
  "website.reinstate.request",
  "website.flag",
  "site.takedown.request",
  "site.reinstate.request",
  "email.resend",
  "demo.manage",
  "audit.view",
]);

export const staffMatrix = Object.fromEntries(
  staffActionIds.map((action) => [
    action,
    {
      super_admin: true,
      customer_success: CS_ALLOWED.has(action),
    },
  ]),
) as Record<StaffAction, Record<StaffRole, boolean>>;

export function staffCan(role: StaffRole, action: StaffAction): boolean {
  return Boolean(staffMatrix[action]?.[role]);
}

export const approvalRules = {
  expiryHours: 48,
  maxOpenPerMember: 10,
  reasonMinChars: 10,
  decisionReasonMinChars: 10,
  idleMinutes: 30,
  absoluteSessionHours: 12,
  reauthMinutes: 15,
  accessSessionMinutes: 60,
  thresholds: {
    refundDualUsd: 250,
    manualPaymentDualUsd: 500,
    creditAdjustDual: 100,
    aiCreditsDual: 5000,
    graceExtendDirectDays: 14,
  },
} as const;

export const forbiddenTables = [
  "pages",
  "publishes",
  "contact_messages",
  "ai_payloads",
  "backups",
] as const;

export function isForbiddenTable(table: string): boolean {
  return (forbiddenTables as readonly string[]).includes(table);
}
