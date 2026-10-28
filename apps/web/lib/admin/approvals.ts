import type { ApprovalKind } from "@get-on/permissions";
import { createClient } from "@/lib/supabase/server";
import { StaffError } from "./staff";

export type { ApprovalKind };

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "executed"
  | "failed"
  | "expired";

export type ApprovalRequest = {
  id: string;
  kind: ApprovalKind;
  target_type: string;
  target_id: string;
  requested_by: string;
  requested_at: string;
  reason: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requires_second: boolean;
  single_operator: boolean;
  expires_at: string;
  state_hash: string | null;
  first_approved_by: string | null;
  first_approved_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  executed_at: string | null;
  execution_error: string | null;
};

export type ApprovalPolicy = {
  kind: ApprovalKind;
  label: string;
  description: string | null;
  request_permission: string;
  approve_permission: string;
  requires_second: boolean;
  threshold_usd: number | string | null;
  threshold_credits: number | null;
  active: boolean;
};

export type ApprovalTab = "waiting" | "mine" | "open" | "closed";

const APPROVAL_COLUMNS =
  "id, kind, target_type, target_id, requested_by, requested_at, reason, payload, status, requires_second, single_operator, expires_at, state_hash, first_approved_by, first_approved_at, decided_by, decided_at, decision_reason, executed_at, execution_error";

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

export async function retryApproval(requestId: string): Promise<void> {
  await rpc("approval_retry", { p_request_id: requestId });
}

export function isStale(request: { expires_at?: string | null }): boolean {
  if (!request?.expires_at) return false;
  return new Date(request.expires_at).getTime() < Date.now();
}

export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select(APPROVAL_COLUMNS)
    .in("status", ["pending", "approved"])
    .order("expires_at", { ascending: true });
  if (error) throw new StaffError(error.message, error.message);
  return (data ?? []) as ApprovalRequest[];
}

export async function listApprovalRequests(input: {
  tab: ApprovalTab;
  userId: string;
  role: "super_admin" | "customer_success";
}): Promise<ApprovalRequest[]> {
  const supabase = await createClient();
  let query = supabase.from("approval_requests").select(APPROVAL_COLUMNS);

  if (input.tab === "mine") {
    query = query.eq("requested_by", input.userId);
  } else if (input.tab === "waiting") {
    if (input.role !== "super_admin") return [];
    query = query.eq("status", "pending").neq("requested_by", input.userId);
  } else if (input.tab === "open") {
    query = query.in("status", ["pending", "approved"]);
  } else {
    query = query.in("status", [
      "rejected",
      "cancelled",
      "expired",
      "executed",
      "failed",
    ]);
  }

  const { data, error } = await query
    .order("expires_at", { ascending: true })
    .limit(200);
  if (error) throw new StaffError(error.message, error.message);

  const rows = (data ?? []) as ApprovalRequest[];
  const filtered =
    input.tab === "waiting"
      ? rows.filter((row) => row.first_approved_by !== input.userId)
      : rows;
  if (input.tab === "mine" || input.tab === "open" || input.tab === "closed") {
    filtered.sort(
      (a, b) =>
        new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime(),
    );
  }
  return filtered;
}

export async function getApprovalRequest(
  requestId: string,
): Promise<ApprovalRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .select(APPROVAL_COLUMNS)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new StaffError(error.message, error.message);
  return (data as ApprovalRequest | null) ?? null;
}

export async function getApprovalPolicies(): Promise<ApprovalPolicy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approval_policies")
    .select(
      "kind, label, description, request_permission, approve_permission, requires_second, threshold_usd, threshold_credits, active",
    )
    .order("kind");
  if (error) throw new StaffError(error.message, error.message);
  return (data ?? []) as ApprovalPolicy[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new StaffError(error.message, error.message);
  return data as T;
}
