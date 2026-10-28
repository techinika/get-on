import type { StaffAction, StaffRole } from "@get-on/permissions";
import { staffCan } from "@get-on/permissions";
import { createClient } from "@/lib/supabase/server";

export type StaffSession = {
  userId: string;
  email: string | null;
  role: StaffRole;
  mfaSatisfied: boolean;
};

export class StaffError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "StaffError";
    this.code = code;
  }
}

/** The signed-in user if they are active platform staff, with their AAL level. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("platform_staff")
    .select("role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff || staff.status !== "active") return null;

  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: staff.role as StaffRole,
    mfaSatisfied: level?.currentLevel === "aal2",
  };
}

/** Staff session or a typed error. Use in admin server components and actions. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new StaffError("NOT_STAFF");
  if (!session.mfaSatisfied) throw new StaffError("STAFF_MFA_REQUIRED");
  return session;
}

export async function requireSuperAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (session.role !== "super_admin") throw new StaffError("STAFF_NOT_ALLOWED");
  return session;
}

export function canStaff(role: StaffRole, action: StaffAction): boolean {
  return staffCan(role, action);
}

export async function requireStaffAction(action: StaffAction): Promise<StaffSession> {
  const session = await requireStaff();
  if (!staffCan(session.role, action)) {
    throw new StaffError("STAFF_NOT_ALLOWED", `Missing permission: ${action}`);
  }
  return session;
}
