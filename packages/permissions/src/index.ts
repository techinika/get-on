export * from "./staff-matrix";

export type Role = "owner" | "admin" | "editor" | "viewer";

export type ApprovalKind =
  | "refund"
  | "manual_payment"
  | "credit_adjust"
  | "access_grant"
  | "invoice_void"
  | "plan_change"
  | "ai_credits"
  | "credits_limit"
  | "website_takedown"
  | "website_reinstate"
  | "grace_extend"
  | "billing_hold"
  | "website_plan_pause"
  | "domain_plan_lapse"
  | "domain_review"
  | "domain_remove"
  | "account_delete"
  | "template_publish"
  | "free_access";

export const matrix = {
  "site.view": { owner: true, admin: true, editor: true, viewer: true },
  "site.create": { owner: true, admin: true, editor: false, viewer: false },
  "site.delete": { owner: true, admin: true, editor: false, viewer: false },
  "site.restore": { owner: true, admin: true, editor: false, viewer: false },
  "site.purge": { owner: true, admin: false, editor: false, viewer: false },
  "site.settings": { owner: true, admin: true, editor: true, viewer: false },
  "site.transfer": { owner: true, admin: false, editor: false, viewer: false },
  "site.domains": { owner: true, admin: true, editor: false, viewer: false },
  "site.plugins": { owner: true, admin: true, editor: false, viewer: false },
  "site.backups": { owner: true, admin: true, editor: false, viewer: false },
  "site.activity": { owner: true, admin: true, editor: true, viewer: true },
  "page.edit": { owner: true, admin: true, editor: true, viewer: false },
  "page.publish": { owner: true, admin: true, editor: true, viewer: false },
  "messages.read": { owner: true, admin: true, editor: true, viewer: true },
  "ai.use": { owner: true, admin: true, editor: true, viewer: false },
  "import.content": { owner: true, admin: true, editor: true, viewer: false },
  "export.content": { owner: true, admin: true, editor: true, viewer: false },
  "export.backup": { owner: true, admin: true, editor: false, viewer: false },
  "export.site_zip": { owner: true, admin: true, editor: true, viewer: false },
  "links.view": { owner: true, admin: true, editor: true, viewer: true },
  "links.manage": { owner: true, admin: true, editor: true, viewer: false },
  "links.delete": { owner: true, admin: true, editor: false, viewer: false },
  "team.activity": { owner: true, admin: true, editor: false, viewer: false },
  "team.rename": { owner: true, admin: true, editor: false, viewer: false },
  "team.invite.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.invite.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.role.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.role.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.remove.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.remove.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.transfer": { owner: true, admin: false, editor: false, viewer: false },
  "team.leave": { owner: false, admin: true, editor: true, viewer: true },
  "referral.use": { owner: true, admin: true, editor: false, viewer: false },
  "plan.manage": { owner: true, admin: false, editor: false, viewer: false },
  "billing.view": { owner: true, admin: true, editor: false, viewer: false },
  "billing.invoices": { owner: true, admin: true, editor: false, viewer: false },
  "billing.pay": { owner: true, admin: true, editor: false, viewer: false },
  "billing.manage": { owner: true, admin: false, editor: false, viewer: false },
  "domain.manage": { owner: true, admin: true, editor: false, viewer: false },
  "plugin.manage": { owner: true, admin: true, editor: false, viewer: false },
  "settings.manage": { owner: true, admin: true, editor: false, viewer: false },
} as const satisfies Record<string, Record<Role, boolean>>;

export type Action = keyof typeof matrix;

export function can(role: Role, action: Action): boolean {
  return Boolean(matrix[action]?.[role]);
}

export function canWithContext(
  actorRole: Role,
  targetRole: Role | undefined,
  action: Action,
): boolean {
  if (!can(actorRole, action)) return false;
  if (!targetRole) return true;
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "admin") {
    return targetRole === "editor" || targetRole === "viewer";
  }
  return false;
}
