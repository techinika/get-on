import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, Action } from "@get-on/permissions";

const admin = createAdminClient();

/** Four-eyes approval engine
 *  - requestApproval: Creates an approval request per policy
 *  - decide: Approves or rejects a request (super admin or customer success)
 *  - Automatic staleness detection (approvals expire after N hours)
 *  - Audit logging for all approval actions
 */

/** Check if an action requires approval per policy */
async function checkApprovalPolicy(
  targetType: string,
  action: Action,
): Promise<{ requires: boolean; policy?: any }> {
  const { data: policy, error } = await admin
    .from("approval_policies")
    .select("*")
    .eq("target_type", targetType)
    .eq("action", action)
    .maybeSingle();

  if (error || !policy) return { requires: false };

  return { requires: policy.requires_approval, policy };
}

/** Request approval for a staff action */
export async function requestApproval(
  actor: Role,
  action: Action,
  targetId: string,
  targetType: "team" | "project" | "page" | "setting" | "content" | "email" | "consent" | "support_case" | "billing" = "page",
): Promise<{ requestId: string; pending: boolean }> {
  const { requires, policy } = await checkApprovalPolicy(targetType, action);

  if (!requires) {
    return { requestId: "", pending: false };
  }

  const staffEmail = (global as any).staffContext?.email;
  if (!staffEmail) throw new Error("NO_STAFF_CONTEXT");

  // Check for existing pending request
  const { data: existing, error: existingError } = await admin
    .from("approval_requests")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { requestId: existing.id, pending: true };
  }

  // Get requester staff ID
  const { data: requesterStaff, error: requesterError } = await admin
    .from("platform_staff")
    .select("id")
    .eq("email", staffEmail)
    .maybeSingle();

  if (requesterError) throw requesterError;

  // Create new approval request
  const { data: requestData, error: requestError } = await admin
    .from("approval_requests")
    .insert({
      policy_id: policy.id,
      requester_id: requesterStaff?.id,
      requester_email: staffEmail,
      target_type: targetType,
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
    target_type: targetType,
    target_id: targetId,
    ip_hash: (global as any).staffContext?.ipHash ?? "00000000-0000-0000-0000-000000000000",
    details: JSON.stringify({ actor, action, targetId, staffEmail }),
  });

  if (logError) throw logError;

  return { requestId, pending: true };
}

/** Decide on an approval request (approve or reject) */
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
  const { data: requesterStaffData, error: requesterStaffError } = await admin
    .from("platform_staff")
    .select("id")
    .eq("email", staffEmail)
    .maybeSingle();

  const { error: logError } = await admin.from("staff_audit_log").insert({
    staff_id: requesterStaffData?.id,
    purpose: "execute",
    action: `approval.${decision}`,
    target_type: "approval",
    target_id: requestId,
    ip_hash: (global as any).staffContext?.ipHash ?? "00000000-0000-0000-0000-000000000000",
    details: JSON.stringify({ requestId, decision, staffEmail }),
  });

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
  const staffEmail = (global as any).staffContext?.email;
  let staffData: any = null;
  let staffError: any = null;

  if (staffEmail) {
    ;({ data: staffData, error: staffError } = await admin
      .from("platform_staff")
      .select("id")
      .eq("email", staffEmail)
      .maybeSingle());
  }

  const staffId = staffError ? undefined : (staffData?.id ?? undefined);

  const { error: logError } = await admin.from("staff_audit_log").insert({
    staff_id: staffId,
    purpose: "execute",
    action: `approval.${action}`,
    target_type: target_type,
    target_id: target_id,
    ip_hash: (global as any).staffContext?.ipHash ?? "00000000-0000-0000-0000-000000000000",
    details: JSON.stringify({ requestId, action, target_type, target_id }),
  });

  if (logError) throw logError;
}

export type { Role, Action };