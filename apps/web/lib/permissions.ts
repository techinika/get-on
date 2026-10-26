import { can as canRole, canWithContext, type Action, type Role } from "@get-on/permissions";

export type { Action, Role };

export function can(role: Role, action: Action): boolean {
  return canRole(role, action);
}

export function canActOn(
  actorRole: Role,
  targetRole: Role | undefined,
  action: Action,
): boolean {
  return canWithContext(actorRole, targetRole, action);
}

export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) {
    const error = new Error("NOT_ALLOWED") as Error & { code: string };
    error.code = "NOT_ALLOWED";
    throw error;
  }
}

export function isRole(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "editor" || value === "viewer";
}
