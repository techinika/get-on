import { createClient } from "@/lib/supabase/server";
import { StaffError } from "./staff";

export type AccessPurpose =
  | "support_case"
  | "billing_question"
  | "payment_issue"
  | "abuse_report"
  | "customer_request"
  | "reporting";

/** Open a 60-minute window to read a team's metadata. Reason is required. */
export async function openCustomerTeam(
  teamId: string,
  purpose: AccessPurpose,
  caseId?: string | null,
  ipHash?: string | null,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_open_access", {
    p_team_id: teamId,
    p_purpose: purpose,
    p_case_id: caseId ?? null,
    p_ip_hash: ipHash ?? null,
  });
  if (error) throw new StaffError(error.message, error.message);
  return data as string;
}

export async function closeCustomerAccess(sessionId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_close_access", {
    p_session_id: sessionId,
  });
  if (error) throw new StaffError(error.message, error.message);
}

export async function getDashboard(): Promise<Record<string, number | boolean>> {
  return rpc<Record<string, number | boolean>>("admin_dashboard", {});
}

export async function searchAccounts(query: string, limit = 20) {
  return rpc("admin_search", { p_query: query, p_limit: limit });
}

export async function listTeams(limit = 100) {
  return rpc<unknown[]>("admin_list_teams", { p_limit: limit });
}

export async function getTeamMetadata(teamId: string) {
  return rpc("admin_team", { p_team_id: teamId });
}

export async function getProjectMetadata(projectId: string) {
  return rpc("admin_project", { p_project_id: projectId });
}

export async function getBillingSummary(teamId: string) {
  return rpc("admin_billing_summary", { p_team_id: teamId });
}

export async function getAiSummary(teamId: string) {
  return rpc("admin_ai_summary", { p_team_id: teamId });
}

export async function getAbuseReports(projectId: string) {
  return rpc<unknown[]>("admin_abuse_reports", { p_project_id: projectId });
}

export async function listEmailLog(limit = 100) {
  return rpc<unknown[]>("admin_email_log", { p_limit: limit });
}

export async function listSupportCases(status?: string | null) {
  return rpc<unknown[]>("admin_support_cases", { p_status: status ?? null });
}

export async function listAudit(limit = 100) {
  return rpc<unknown[]>("admin_audit_list", { p_limit: limit });
}

export async function listStaff() {
  return rpc<unknown[]>("admin_staff_list", {});
}

export async function recordStaffAction(input: {
  action: string;
  targetType: string;
  targetId: string;
  purpose?: string | null;
  reason?: string | null;
  approvalId?: string | null;
  details?: Record<string, unknown>;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  return rpc<string>("staff_audit", {
    p_action: input.action,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_purpose: input.purpose ?? null,
    p_reason: input.reason ?? null,
    p_approval_id: input.approvalId ?? null,
    p_details: input.details ?? {},
    p_ip_hash: input.ipHash ?? null,
    p_user_agent: input.userAgent ?? null,
  });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new StaffError(error.message, error.message);
  return data as T;
}

export async function extendBillingGrace(input: {
  teamId: string;
  days: number;
  reason: string;
  approvalId?: string | null;
}) {
  return rpc<{ ok: boolean; grace_ends_at?: string; duplicate?: boolean }>(
    "admin_billing_extend_grace",
    {
      p_team: input.teamId,
      p_days: input.days,
      p_reason: input.reason,
      p_approval: input.approvalId ?? null,
    },
  );
}

export async function setBillingHold(input: {
  teamId: string;
  action: "place" | "release";
  reason: string;
  caseId?: string | null;
  days?: number | null;
  approvalId?: string | null;
}) {
  return rpc<{ ok: boolean; hold_id?: string; duplicate?: boolean }>(
    "admin_billing_set_hold",
    {
      p_team: input.teamId,
      p_action: input.action,
      p_reason: input.reason,
      p_case_id: input.caseId ?? null,
      p_days: input.days ?? null,
      p_approval: input.approvalId ?? null,
    },
  );
}

export async function setMemberAiLimit(input: {
  teamId: string;
  memberId: string;
  monthlyCredits: number;
  note: string;
  approvalId?: string | null;
}) {
  return rpc<{ ok: boolean; from: number | null; to: number }>(
    "admin_ai_set_member_limit",
    {
      p_team: input.teamId,
      p_member: input.memberId,
      p_monthly_credits: input.monthlyCredits,
      p_note: input.note,
      p_approval: input.approvalId ?? null,
    },
  );
}

export async function listProjects(limit = 200) {
  return rpc<unknown[]>("admin_list_projects", { p_limit: limit });
}

export async function getEmailSummary() {
  return rpc<Record<string, number>>("admin_email_summary", {});
}

export async function listEmailSuppressions(limit = 50) {
  return rpc<unknown[]>("admin_email_suppressions", { p_limit: limit });
}

export async function getDomainOps() {
  return rpc<{
    counts: Record<string, number>;
    runs: unknown[];
    health: Record<string, unknown> | null;
  }>("admin_domain_ops", {});
}

export async function setTeamPlan(teamId: string, planId: string, note: string) {
  return rpc<{ ok: boolean; from: string; to: string }>("admin_set_team_plan", {
    p_team: teamId,
    p_plan: planId,
    p_note: note,
  });
}
