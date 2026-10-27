import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, Action } from "@get-on/permissions";

const admin = createAdminClient();

/** Repositories for admin console data access through approved views */

/** Load all teams with member counts and status */
export async function loadTeamsWithMembers() {
  const { data: teams, error } = await admin
    .from("v_teams_with_members_full")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return teams || [];
}

/** Load a single team with all members */
export async function loadTeamWithMembers(teamId: string) {
  const { data: team, error } = await admin
    .from("v_teams_with_members")
    .select("*")
    .eq("id", teamId)
    .single();

  if (error) throw error;
  if (!team) throw new Error("TEAM_NOT_FOUND");
  const { data: members } = await admin
    .from("team_members")
    .select("*")
    .eq("team_id", teamId);
  return { team, members };
}

/** Load all projects for a team */
export async function loadProjectsForTeam(teamId: string) {
  const { data: projects, error } = await admin
    .from("v_projects_with_team")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return projects || [];
}

/** Load a single project with context */
export async function loadProjectWithContext(projectId: string) {
  const { data: project, error } = await admin
    .from("v_projects_with_team")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) throw error;
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return project;
}

/** Load all pages for a project */
export async function loadPagesForProject(projectId: string) {
  const { data: pages, error } = await admin
    .from("v_pages_with_context")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return pages || [];
}

/** Load a single page with full context */
export async function loadPageWithContext(pageId: string) {
  const { data: page, error } = await admin
    .from("v_pages_with_context")
    .select("*")
    .eq("id", pageId)
    .single();

  if (error) throw error;
  if (!page) throw new Error("PAGE_NOT_FOUND");
  return page;
}

/** Load all publishes for a project */
export async function loadPublishesForProject(projectId: string) {
  const { data: publishes, error } = await admin
    .from("publishes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return publishes || [];
}

/** Load all abuse reports for a project */
export async function loadAbuseReportsForProject(projectId: string) {
  const { data: reports, error } = await admin
    .from("abuse_reports")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return reports || [];
}

/** Load all site flags for a project */
export async function loadSiteFlagsForProject(projectId: string) {
  const { data: flags, error } = await admin
    .from("site_flags")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return flags || [];
}

/** Load admin audit log entries */
export async function loadAdminAuditLog(limit: number = 50) {
  const { data: audit, error } = await admin
    .from("admin_audit_log")
    .select("id, admin_email, action, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return audit || [];
}

/** Load platform staff list */
export async function loadPlatformStaff() {
  const { data: staff, error } = await admin
    .from("platform_staff")
    .select("id, email, name, role, totp_enabled, last_login_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return staff || [];
}

/** Load a single staff member */
export async function loadStaffMember(email: string) {
  const { data: staff, error } = await admin
    .from("platform_staff")
    .select("id, email, name, role, totp_enabled, last_login_at, created_at")
    .eq("email", email)
    .single();

  if (error) throw error;
  if (!staff) throw new Error("STAFF_NOT_FOUND");
  return staff;
}

/** Load approval policies */
export async function loadApprovalPolicies() {
  const { data: policies, error } = await admin
    .from("approval_policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return policies || [];
}

/** Load pending approval requests */
export async function loadPendingApprovals() {
  const { data: requests, error } = await admin
    .from("approval_requests")
    .select("*, platform_staff (*)")
    .eq("status", "pending")
    .order("expires_at", { ascending: true });

  if (error) throw error;
  return requests || [];
}

/** Load support cases with assigned staff */
export async function loadSupportCasesWithAssignees() {
  const { data: cases, error } = await admin
    .from("support_cases")
    .select("*, platform_staff (*), teams (*)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return cases || [];
}

/** Load email preferences for a user */
export async function loadEmailPreferences(userId: string) {
  const { data: prefs, error } = await admin
    .from("email_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  if (!prefs) return null;
  return prefs;
}

/** Load consent records for a user */
export async function loadConsentRecords(userId: string) {
  const { data: records, error } = await admin
    .from("consent_records")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return records || [];
}

/** Record a staff action in the audit log (internal use) */
export async function recordStaffAction(
  staffEmail: string,
  purpose: "read" | "write" | "execute" | "delete",
  action: string,
  targetType: string,
  targetId: string,
  context: Record<string, unknown>,
): Promise<void> {
  const { data: staffData, error: staffError } = await admin
    .from("platform_staff")
    .select("id")
    .eq("email", staffEmail)
    .maybeSingle();

  if (staffError) throw staffError;
  const staffId = staffData?.id;

  const { error } = await admin.from("staff_audit_log").insert({
    staff_id: staffId,
    purpose,
    action,
    target_type: targetType,
    target_id: targetId,
    ip_hash: (global as any).staffContext?.ipHash ?? "00000000-0000-0000-0000-000000000000",
    details: JSON.stringify(context),
  });

  if (error) throw error;
}

export type { Role, Action };