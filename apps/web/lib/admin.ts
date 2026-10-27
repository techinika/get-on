/** Comma-separated ADMIN_EMAILS, lower-cased. Empty means nobody is an admin. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Set the acting staff member's email in the global context */
export function setStaffContext(email: string, ipHash: string): void {
  ;(global as any).staffContext = { email, ipHash };
}

/** Clear the staff context */
export function clearStaffContext(): void {
  ;(global as any).staffContext = null;
}

/** Check if the current acting staff has a specific role */
export function hasRole(role: "super_admin" | "customer_success"): boolean {
  const email = (global as any).staffContext?.email;
  if (!email) return false;
  return email.includes(role);
}

/** Check if the current acting staff is a super admin */
export function isSuperAdmin(): boolean {
  return hasRole("super_admin");
}

/** Check if the current acting staff is customer success */
export function isCustomerSuccess(): boolean {
  return hasRole("customer_success");
}

export default {
  setStaffContext,
  clearStaffContext,
  hasRole,
  isSuperAdmin,
  isCustomerSuccess,
  adminEmails,
  isAdminEmail,
};