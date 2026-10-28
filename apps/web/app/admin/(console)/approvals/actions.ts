"use server";

import { revalidatePath } from "next/cache";
import {
  cancelApproval,
  decideApproval,
  retryApproval,
} from "@/lib/admin/approvals";
import { requireStaff, requireSuperAdmin } from "@/lib/admin/staff";
import { executeApproval } from "@/lib/admin-actions/approvals";
import { queueApprovalOutcome } from "@/lib/email/approval-notifications";

export type ApprovalActionResult = { ok: true; message?: string } | { ok: false; error: string };

function failure(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("APPROVAL_FOUR_EYES")) {
    return "You cannot decide your own request, or approve twice. Another Super admin must decide.";
  }
  if (raw.includes("APPROVAL_EXPIRED")) {
    return "This request has expired. Ask for a new approval.";
  }
  if (raw.includes("APPROVAL_NOT_PENDING")) {
    return "This request is no longer waiting for a decision.";
  }
  if (raw.includes("APPROVAL_NOT_APPROVED")) {
    return "This request is not ready to run.";
  }
  if (raw.includes("APPROVAL_NOT_FAILED")) {
    return "This request cannot be tried again.";
  }
  if (raw.includes("APPROVAL_REASON")) {
    return "Add at least 10 characters explaining the decision.";
  }
  if (raw.includes("STAFF_NOT_ALLOWED")) {
    return "You do not have permission to do that.";
  }
  return "We could not save that decision.";
}

function refresh(requestId?: string) {
  revalidatePath("/admin/approvals");
  if (requestId) revalidatePath(`/admin/approvals/${requestId}`);
}

function cleanReason(reason: string): string | null {
  const cleaned = reason.trim();
  return cleaned.length >= 10 && cleaned.length <= 500 ? cleaned : null;
}

export async function approveApprovalAction(
  requestId: string,
  reason: string,
): Promise<ApprovalActionResult> {
  await requireStaff();
  const cleaned = cleanReason(reason);
  if (!cleaned) {
    return { ok: false, error: "Add at least 10 characters explaining the decision." };
  }

  try {
    const status = await decideApproval(requestId, "approved", cleaned);
    if (status === "awaiting_second") {
      await queueApprovalOutcome(requestId);
      refresh(requestId);
      return { ok: true, message: "Waiting for a second Super admin." };
    }
  } catch (error) {
    return { ok: false, error: failure(error) };
  }

  const result = await executeApproval(requestId, (await requireSuperAdmin()).userId);
  await queueApprovalOutcome(requestId);
  refresh(requestId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Approved and done." };
}

export async function rejectApprovalAction(
  requestId: string,
  reason: string,
): Promise<ApprovalActionResult> {
  await requireStaff();
  const cleaned = cleanReason(reason);
  if (!cleaned) {
    return { ok: false, error: "Add at least 10 characters explaining the decision." };
  }
  try {
    await decideApproval(requestId, "rejected", cleaned);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
  await queueApprovalOutcome(requestId);
  refresh(requestId);
  return { ok: true, message: "Request rejected." };
}

export async function requestChangesAction(
  requestId: string,
  reason: string,
): Promise<ApprovalActionResult> {
  await requireStaff();
  const cleaned = cleanReason(reason);
  if (!cleaned) {
    return { ok: false, error: "Say what needs to change in at least 10 characters." };
  }
  try {
    await decideApproval(requestId, "rejected", `Changes requested: ${cleaned}`);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
  await queueApprovalOutcome(requestId);
  refresh(requestId);
  return {
    ok: true,
    message: "Changes requested. The request is closed; ask for a new one.",
  };
}

export async function cancelApprovalAction(
  requestId: string,
): Promise<ApprovalActionResult> {
  await requireStaff();
  try {
    await cancelApproval(requestId);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
  refresh(requestId);
  return { ok: true, message: "Request cancelled." };
}

export async function executeApprovalAction(
  requestId: string,
): Promise<ApprovalActionResult> {
  const staff = await requireSuperAdmin();
  const result = await executeApproval(requestId, staff.userId);
  await queueApprovalOutcome(requestId);
  refresh(requestId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Done." };
}

export async function retryApprovalAction(
  requestId: string,
): Promise<ApprovalActionResult> {
  const staff = await requireSuperAdmin();
  try {
    await retryApproval(requestId);
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
  const result = await executeApproval(requestId, staff.userId);
  await queueApprovalOutcome(requestId);
  refresh(requestId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Tried again and done." };
}
