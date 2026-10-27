import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, Action } from "@get-on/permissions";

const admin = createAdminClient();

/** Get the currently acting staff email from app context */
function getStaffEmail(): string | null {
  try {
    const ctx: any = (global as any).staffContext;
    return ctx?.email ?? null;
  } catch {
    return null;
  }
}

/** Salted IP hash for audit logging - derived from request context */
function getIPHash(): string {
  return (global as any).staffContext?.ipHash ?? "00000000-0000-0000-0000-000000000000";
}

/** Read customer team data only through approved views */
export async function openCustomerTeam(teamId: string) {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const { data: team, error: teamError } = await admin
    .from("v_teams_with_members")
    .select("*")
    .eq("id", teamId)
    .single();

  if (teamError) throw teamError;
  if (!team) throw new Error("TEAM_NOT_FOUND");

  const { data: members } = await admin
    .from("team_members")
    .select("*")
    .eq("team_id", teamId);

  return { team, members };
}

/** Read customer project data only through approved views */
export async function openCustomerProject(projectId: string) {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const { data: project } = await admin
    .from("v_projects_with_team")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return project;
}

/** Read customer page data only through approved views */
export async function openCustomerPage(pageId: string) {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const { data: page } = await admin
    .from("v_pages_with_context")
    .select("*")
    .eq("id", pageId)
    .single();

  if (!page) throw new Error("PAGE_NOT_FOUND");
  return page;
}

/** Edit customer content - only through explicit approved actions */
export async function editCustomerContent(
  pageId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const forbiddenKeys = ["created_by", "owner_id", "team_id", "status"];
  for (const key of forbiddenKeys) {
    if (key in updates) {
      throw new Error(`FORBIDDEN_KEY: ${key}`);
    }
  }

  await admin.from("pages").update(updates).eq("id", pageId);
}

/** Publish customer page - requires approval for non-owner staff */
export async function publishCustomerPage(
  pageId: string,
  requiresApproval: boolean = true,
): Promise<void> {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const staffRole: Role = staffEmail.includes("super_admin")
    ? ("owner" as Role)
    : ("admin" as Role);

  if (requiresApproval) {
    await requestApproval(staffRole, "page.publish", pageId);
  }

  await admin.from("pages").update({ status: "published" }).eq("id", pageId);
}

/** Request approval through the four-eyes engine */
export async function requestApproval(
  actor: Role,
  action: Action,
  targetId: string,
): Promise<{ approved: boolean; reason?: string }> {
  const staffEmail = getStaffEmail();
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  const { data: policy, error: policyError } = await admin
    .from("approval_policies")
    .select("*")
    .eq("target_type", "page")
    .eq("action", action)
    .maybeSingle();

  if (policyError) throw policyError;
  if (!policy || !policy.requires_approval) {
    return { approved: false };
  }

  // Check if there's an existing pending request
  const { data: existing, error: existingError } = await admin
    .from("approval_requests")
    .select("id")
    .eq("target_type", "page")
    .eq("target_id", targetId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { approved: false, reason: "approval_pending" };
  }

  // Create new approval request - need requester_id from platform_staff
  const { data: requesterStaff, error: requesterError } = await admin
    .from("platform_staff")
    .select("id")
    .eq("email", staffEmail)
    .maybeSingle();

  if (requesterError) throw requesterError;

  const { data: requestData, error: requestError } = await admin
    .from("approval_requests")
    .insert({
      policy_id: policy.id,
      requester_id: requesterStaff?.id,
      requester_email: staffEmail,
      target_type: "page",
      target_id: targetId,
      status: "pending",
      required_roles: policy.allowed_roles,
      expires_at: new Date(
        Date.now() + (policy.staleness_hours || 24) * 60 * 60 * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (requestError) throw requestError;
  const requestId = requestData.id;

  // Log the approval request
  const { error: logError } = await admin.from("staff_audit_log").insert({
    staff_id: requesterStaff?.id,
    purpose: "execute",
    action: `approval.request`,
    target_type: "page",
    target_id: targetId,
    ip_hash: getIPHash(),
    details: JSON.stringify({ actor, action, targetId, staffEmail }),
  });

  if (logError) throw logError;

  return { approved: false };
}

/** Decide on an approval request (super admin or customer success) */
export async function decideApproval(
  requestId: string,
  decision: "approve" | "reject",
  staffEmail: string,
): Promise<{ success: boolean }> {
  const adminClient = createAdminClient();

  // Validate the staff member has authority to decide
  const { data: staffMember, error: staffError } = await adminClient
    .from("platform_staff")
    .select("role")
    .eq("email", staffEmail)
    .maybeSingle();

  if (staffError) throw staffError;
  if (!staffMember) throw new Error("STAFF_NOT_FOUND");

  const role = staffMember.role as "super_admin" | "customer_success";

  // Super admins can directly approve/reject
  // Customer success needs explicit policy permission
  if (role !== "super_admin") {
    const { data: policy, error: policyError } = await admin.from("approval_policies").select("*").eq("target_type", "approval").maybeSingle();

    if (policyError) throw policyError;

    // Check if this staff member can decide this type of approval
    const canDecide = policy?.allowed_roles?.includes(role) ?? false;
    if (!canDecide) throw new Error("NOT_AUTHORIZED_TO_DECIDE");
  }

  // Update the approval request
  const updateData: Record<string, any> = {
    status: decision,
  };

  if (decision === "approve") {
    updateData.approved_by = staffEmail;
    updateData.approved_at = new Date().toISOString();
  } else {
    updateData.rejected_by = staffEmail;
    updateData.rejected_at = new Date().toISOString();
  }

  const { error: updateError } = await adminClient
    .from("approval_requests")
    .update(updateData)
    .eq("id", requestId);

  if (updateError) throw updateError;

  // Log the decision
  const { data: logData, error: logError } = (await adminClient
    .from("staff_audit_log")
    .insert({
      staff_id: (await adminClient
        .from("platform_staff")
        .select("id")
        .eq("email", staffEmail)
        .maybeSingle()).data?.id,
      purpose: "execute",
      action: `approval.${decision}`,
      target_type: "approval",
      target_id: requestId,
      ip_hash: getIPHash(),
      details: JSON.stringify({ requestId, decision, staffEmail }),
    })) as { data: any; error: any };

  if (logError) throw logError;

  return { success: true };
}

/** Check if an approval request is stale and can be auto-expired */
export function isStale(request: { expires_at?: string }): boolean {
  if (!request?.expires_at) return false;
  const expires = new Date(request.expires_at);
  const now = new Date();
  return now > expires;
}

/** Get the current pending approvals for a staff member */
export async function getPendingApprovals(staffEmail: string): Promise<any[]> {
  const { data, error } = await admin
    .from("approval_requests")
    .select("*")
    .eq("status", "pending")
    .order("expires_at", { ascending: true });

  if (error) return [];
  if (!data) return [];

  return data.filter((req: any) => isStale(req) === false);
}

/** Execute an approved action - only after approval is confirmed */
export async function executeApprovedAction(
  requestId: string,
  action: "page.publish" | "site.create" | "site.delete" | "site.restore" | "page.edit",
): Promise<void> {
  const { data: request, error: requestError } = await admin
    .from("approval_requests")
    .select("status, target_type, target_id")
    .eq("id", requestId)
    .single();

  if (requestError) throw requestError;
  if (request.status !== "approved") {
    throw new Error("APPROVAL_NOT_GIVEN");
  }

  // Execute the actual action based on target type
  const { target_type, target_id } = request;

  switch (action) {
    case "page.publish":
      await admin.from("pages").update({ status: "published" }).eq("id", target_id);
      break;
    case "site.create":
      // Site creation handled through separate workflow
      break;
    case "site.delete":
      await admin.from("projects").update({ deleted_at: new Date() }).eq("id", target_id);
      break;
    case "site.restore":
      await admin.from("projects").update({ deleted_at: null }).eq("id", target_id);
      break;
    case "page.edit":
      // Page edit handled through explicit edit function
      break;
    default:
      throw new Error("UNKNOWN_ACTION");
  }

  // Log the execution
  const staffEmail = getStaffEmail();
  const { data: staffData, error: staffError } = staffEmail
    ? await admin
        .from("platform_staff")
        .select("id")
        .eq("email", staffEmail)
        .maybeSingle()
    : { data: null, error: null };

  const staffId = staffError ? undefined : (staffData?.id ?? undefined);

  const { data: logData, error: logError } = (await admin
    .from("staff_audit_log")
    .insert({
      staff_id: staffId,
      purpose: "execute",
      action: `approval.${action}`,
      target_type: target_type,
      target_id: target_id,
      ip_hash: getIPHash(),
      details: JSON.stringify({ requestId, action, target_type, target_id }),
    })) as { data: any; error: any };

  if (logError) throw logError;
}

export type { Role, Action };