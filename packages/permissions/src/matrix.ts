export type Role = "owner" | "admin" | "editor" | "viewer";

export type Action =
  | "site.view"
  | "site.create"
  | "site.delete"
  | "site.restore"
  | "site.purge"
  | "site.transfer"
  | "page.edit"
  | "page.publish"
  | "site.settings"
  | "site.domains"
  | "site.plugins"
  | "site.backups"
  | "links.view"
  | "links.manage"
  | "links.delete"
  | "export.content"
  | "export.backup"
  | "export.site_zip"
  | "import.content"
  | "messages.read"
  | "template.use"
  | "template.manage"
  | "template.delete"
  | "ai.use"
  | "ai.limits"
  | "ai.ledger.all"
  | "team.view"
  | "team.invite.admin"
  | "team.invite.member"
  | "team.role.admin"
  | "team.role.member"
  | "team.remove.admin"
  | "team.remove.member"
  | "team.rename"
  | "team.transfer"
  | "team.leave"
  | "team.activity"
  | "site.activity"
  | "plan.view"
  | "plan.manage"
  | "billing.invoices"
  | "billing.pay"
  | "billing.notices"
  | "referral.use";

export const matrix: Record<Action, Record<Role, boolean>> = {
  "site.view": { owner: true, admin: true, editor: true, viewer: true },
  "site.create": { owner: true, admin: true, editor: false, viewer: false },
  "site.delete": { owner: true, admin: true, editor: false, viewer: false },
  "site.restore": { owner: true, admin: true, editor: false, viewer: false },
  "site.purge": { owner: true, admin: false, editor: false, viewer: false },
  "site.transfer": { owner: true, admin: true, editor: false, viewer: false },
  "page.edit": { owner: true, admin: true, editor: true, viewer: false },
  "page.publish": { owner: true, admin: true, editor: true, viewer: false },
  "site.settings": { owner: true, admin: true, editor: false, viewer: false },
  "site.domains": { owner: true, admin: true, editor: false, viewer: false },
  "site.plugins": { owner: true, admin: true, editor: false, viewer: false },
  "site.backups": { owner: true, admin: true, editor: true, viewer: false },
  "links.view": { owner: true, admin: true, editor: true, viewer: true },
  "links.manage": { owner: true, admin: true, editor: true, viewer: false },
  "links.delete": { owner: true, admin: true, editor: false, viewer: false },
  "export.content": { owner: true, admin: true, editor: true, viewer: false },
  "export.backup": { owner: true, admin: true, editor: true, viewer: false },
  "export.site_zip": { owner: true, admin: true, editor: false, viewer: false },
  "import.content": { owner: true, admin: true, editor: true, viewer: false },
  "messages.read": { owner: true, admin: true, editor: true, viewer: false },
  "template.use": { owner: true, admin: true, editor: true, viewer: false },
  "template.manage": { owner: true, admin: true, editor: true, viewer: false },
  "template.delete": { owner: true, admin: true, editor: false, viewer: false },
  "ai.use": { owner: true, admin: true, editor: true, viewer: false },
  "ai.limits": { owner: true, admin: true, editor: false, viewer: false },
  "ai.ledger.all": { owner: true, admin: true, editor: false, viewer: false },
  "team.view": { owner: true, admin: true, editor: true, viewer: true },
  "team.invite.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.invite.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.role.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.role.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.remove.admin": { owner: true, admin: false, editor: false, viewer: false },
  "team.remove.member": { owner: true, admin: true, editor: false, viewer: false },
  "team.rename": { owner: true, admin: true, editor: false, viewer: false },
  "team.transfer": { owner: true, admin: false, editor: false, viewer: false },
  "team.leave": { owner: false, admin: true, editor: true, viewer: true },
  "team.activity": { owner: true, admin: true, editor: false, viewer: false },
  "site.activity": { owner: true, admin: true, editor: true, viewer: false },
  "plan.view": { owner: true, admin: true, editor: false, viewer: false },
  "plan.manage": { owner: true, admin: false, editor: false, viewer: false },
  "billing.invoices": { owner: true, admin: true, editor: false, viewer: false },
  "billing.pay": { owner: true, admin: false, editor: false, viewer: false },
  "billing.notices": { owner: true, admin: true, editor: false, viewer: false },
  "referral.use": { owner: true, admin: true, editor: true, viewer: true },
};

export function can(role: Role, action: Action): boolean {
  return matrix[action]?.[role] === true;
}

export function canWithContext(
  actor: Role,
  target: Role | undefined,
  action: Action,
): boolean {
  if (!can(actor, action)) return false;
  if (action === "team.role.member") {
    if (actor === "owner") return target === "admin" || target === "editor" || target === "viewer";
    if (actor === "admin") return target === "editor" || target === "viewer";
    return false;
  }
  if (action === "team.remove.member") {
    if (actor === "owner") return target !== "owner";
    if (actor === "admin") return target === "editor" || target === "viewer";
    return false;
  }
  if (action === "team.remove.admin") {
    return actor === "owner" && target === "admin";
  }
  if (action === "team.role.admin") {
    return actor === "owner" && (target === "admin" || target === "editor" || target === "viewer");
  }
  return true;
}

export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) {
    const err = new Error("NOT_ALLOWED") as Error & { code: string };
    err.code = "NOT_ALLOWED";
    throw err;
  }
}
