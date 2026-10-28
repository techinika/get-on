import { createClient } from "@/lib/supabase/server";
import { StaffError } from "../staff";
import {
  getAbuseReports,
  getProjectMetadata,
  getTeamMetadata,
  listAudit,
  listEmailLog,
  listStaff,
  listSupportCases,
  listTeams,
  recordStaffAction,
} from "../access";
import type { ApprovalRequest } from "../approvals";

/** Staff read helpers. They only ever return metadata, never customer content. */

export async function loadTeamsWithMembers() {
  return listTeams(200);
}

export async function loadTeamWithMembers(teamId: string) {
  const team = await getTeamMetadata(teamId);
  return { team };
}

export async function loadProjectsForTeam(teamId: string) {
  const team = (await getTeamMetadata(teamId)) as {
    websites?: unknown[];
  } | null;
  return team?.websites ?? [];
}

export async function loadProjectWithContext(projectId: string) {
  return getProjectMetadata(projectId);
}

export async function loadPublishesForProject(projectId: string) {
  const project = (await getProjectMetadata(projectId)) as {
    publishes?: unknown[];
  } | null;
  return project?.publishes ?? [];
}

export async function loadAbuseReportsForProject(projectId: string) {
  return getAbuseReports(projectId);
}

export async function loadSiteFlagsForProject(projectId: string) {
  const project = (await getProjectMetadata(projectId)) as {
    flags?: unknown[];
  } | null;
  return project?.flags ?? [];
}

export async function loadAdminAuditLog(limit = 100) {
  return listAudit(limit);
}

export async function loadPlatformStaff() {
  return listStaff();
}

export async function loadStaffMember(userId: string) {
  const staff = (await listStaff()) as Array<{ user_id?: string }>;
  return staff.find((member) => member.user_id === userId) ?? null;
}

export async function loadApprovalPolicies() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_policies")
    .select("*")
    .order("kind");
  if (error) throw new StaffError(error.message, error.message);
  return data ?? [];
}

export async function loadPendingApprovals(): Promise<ApprovalRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select("*")
    .in("status", ["pending", "approved"])
    .order("expires_at", { ascending: true });
  if (error) throw new StaffError(error.message, error.message);
  return (data ?? []) as ApprovalRequest[];
}

export async function loadSupportCasesWithAssignees() {
  return listSupportCases(null);
}

export async function loadEmailLog(limit = 100) {
  return listEmailLog(limit);
}

export async function loadEmailPreferences(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new StaffError(error.message, error.message);
  return data;
}

export async function loadConsentRecords(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select("id, kind, granted, source, policy_version, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new StaffError(error.message, error.message);
  return data ?? [];
}

export async function recordStaffActionRow(input: Parameters<typeof recordStaffAction>[0]) {
  return recordStaffAction(input);
}
