"use server";

import { revalidatePath } from "next/cache";
import {
  approvalRequestKind,
  buildApprovalRequest,
  type ApprovalRequestInput,
} from "@/lib/admin/approval-request";
import { getApprovalPolicies, requestApproval } from "@/lib/admin/approvals";
import { canStaff, requireStaff } from "@/lib/admin/staff";
import { queueApprovalRequested } from "@/lib/email/approval-notifications";
import type { StaffAction } from "@get-on/permissions";

export type CreateApprovalResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

function failure(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("APPROVAL_UNKNOWN")) return "That action is not available.";
  if (raw.includes("APPROVAL_REASON")) {
    return "Add a reason between 10 and 500 characters.";
  }
  if (raw.includes("APPROVAL_TOO_MANY_OPEN")) {
    return "You already have 20 requests waiting. Finish or cancel some first.";
  }
  if (
    raw.includes("23505") ||
    raw.includes("approval_requests_one_open_idx") ||
    raw.includes("duplicate key")
  ) {
    return "You already have an open request for this action and record.";
  }
  if (raw.includes("STAFF_NOT_ALLOWED")) {
    return "You do not have permission to request that action.";
  }
  return "We could not send that request. Nothing was changed.";
}

export async function createApprovalRequestAction(
  input: ApprovalRequestInput,
): Promise<CreateApprovalResult> {
  const staff = await requireStaff();
  const config = approvalRequestKind(input.kind);
  if (!config) return { ok: false, error: "Choose an action." };

  const built = buildApprovalRequest(input);
  if (!built.ok) return { ok: false, error: built.error };

  const policies = await getApprovalPolicies();
  const policy = policies.find((item) => item.kind === built.value.kind);
  if (
    !policy ||
    !policy.active ||
    !canStaff(staff.role, policy.request_permission as StaffAction)
  ) {
    return {
      ok: false,
      error: "You do not have permission to request that action.",
    };
  }

  try {
    const requestId = await requestApproval({
      kind: built.value.kind,
      targetType: built.value.targetType,
      targetId: built.value.targetId,
      reason: built.value.reason,
      payload: built.value.payload,
      amountUsd: built.value.amountUsd,
      amountCredits: built.value.amountCredits,
    });
    await queueApprovalRequested(requestId);
    revalidatePath("/admin/approvals");
    return { ok: true, requestId };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}
