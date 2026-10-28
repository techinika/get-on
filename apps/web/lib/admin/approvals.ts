import type { ApprovalKind } from "@get-on/permissions";
import { createClient } from "@/lib/supabase/server";
import { StaffError } from "./staff";

export type { ApprovalKind };

export type ApprovalRequest = {
  id: string;
  kind: ApprovalKind;
  target_type: string;
  target_id: string;
  requested_by: string;
  requested_at: string;
  reason: string;
  payload: Record<string, unknown>;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "executed"
    | "failed"
    | "expired";
  requires_second: boolean;
  single_operator: boolean;
  expires_at: string;
  decision_reason: string | null;
};

export async function requestApproval(input: {
  kind: ApprovalKind;
  targetType: string;
  targetId: string;
  reason: string;
  payload?: Record<string, unknown>;
  stateHash?: string | null;
  amountUsd?: number | null;
  amountCredits?: number | null;
}): Promise<string> {
  return rpc<string>("approval_request", {
    p_kind: input.kind,
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_payload: input.payload ?? {},
    p_state_hash: input.stateHash ?? null,
    p_amount_usd: input.amountUsd ?? null,
    p_amount_credits: input.amountCredits ?? null,
  });
}

export async function decideApproval(
  requestId: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<string> {
  return rpc<string>("approval_decide", {
    p_request_id: requestId,
    p_decision: decision,
    p_reason: reason,
  });
}

export async function beginApproval(requestId: string, stateHash?: string | null) {
  return rpc<{
    id: string;
    kind: ApprovalKind;
    target_type: string;
    target_id: string;
    payload: Record<string, unknown>;
  }>("approval_begin_execute", {
    p_request_id: requestId,
    p_state_hash: stateHash ?? null,
  });
}

export async function finishApproval(
  requestId: string,
  ok: boolean,
  error?: string | null,
): Promise<void> {
  await rpc("approval_finish_execute", {
    p_request_id: requestId,
    p_ok: ok,
    p_error: error ?? null,
  });
}

export async function cancelApproval(requestId: string): Promise<void> {
  await rpc("approval_cancel", { p_request_id: requestId });
}

export function isStale(request: { expires_at?: string | null }): boolean {
  if (!request?.expires_at) return false;
  return new Date(request.expires_at).getTime() < Date.now();
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select(
      "id, kind, target_type, target_id, requested_by, requested_at, reason, payload, status, requires_second, single_operator, expires_at, decision_reason",
    )
    .in("status", ["pending", "approved"])
    .order("expires_at", { ascending: true });
  if (error) throw new StaffError(error.message, error.message);
  return (data ?? []) as ApprovalRequest[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new StaffError(error.message, error.message);
  return data as T;
}
