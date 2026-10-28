import { createAdminClient } from "@/lib/supabase/admin";
import {
  beginApproval,
  finishApproval,
  getApprovalRequest,
  type ApprovalKind,
  type ApprovalRequest,
} from "@/lib/admin/approvals";
import { setTeamPlan } from "@/lib/admin/access";
import { createBillingGrant, voidBillingInvoice } from "@/lib/admin/screens";
import { BillingError, refundPayment } from "@/lib/billing/service";
import {
  approveDomain,
  rejectDomain,
  removeDomain,
} from "@/lib/domains/admin-actions";
import { bringSiteOnline, takeSiteOffline } from "@/lib/admin-actions/site";

export type ApprovalExecutionResult =
  | { ok: true }
  | { ok: false; error: string };

class ApprovalActionError extends Error {}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function integer(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number.parseInt(value, 10)
          : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function uuid(value: string, label: string): string {
  if (!UUID.test(value)) {
    throw new ApprovalActionError(`This request is missing a valid ${label}.`);
  }
  return value;
}

function date(value: string, label: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ApprovalActionError(`This request has an invalid ${label}.`);
  }
  return parsed.toISOString();
}

function unsupported(): never {
  throw new ApprovalActionError(
    "This action is not connected to the staff console yet. Nothing was changed.",
  );
}

async function runRefund(request: ApprovalRequest, staffId: string) {
  if (request.target_type !== "payment") unsupported();
  const paymentId = uuid(request.target_id, "payment");
  const payloadPayment = text(request.payload, "payment_id");
  if (payloadPayment && payloadPayment !== paymentId) {
    throw new ApprovalActionError(
      "The payment in this request no longer matches the target.",
    );
  }

  const amountCents = integer(request.payload, ["amount_cents"]);
  if (amountCents === null || amountCents <= 0) {
    throw new ApprovalActionError("This request is missing a refund amount.");
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id, team_id, amount_cents, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) {
    throw new ApprovalActionError("We could not find that payment.");
  }
  if (!["confirmed", "partly_refunded"].includes(String(payment.status))) {
    throw new ApprovalActionError("That payment can no longer be refunded.");
  }
  if (amountCents > Number(payment.amount_cents)) {
    throw new ApprovalActionError("That is more than the payment amount.");
  }

  const { data: existing } = await admin
    .from("refunds")
    .select("id")
    .eq("approval_id", request.id)
    .in("status", ["requested", "processed"])
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const result = await refundPayment({
    teamId: String(payment.team_id),
    paymentId,
    amountCents,
    reason: request.reason,
    actorId: staffId,
    approvalId: request.id,
  });
  if (result.status === "failed") {
    throw new ApprovalActionError(
      "The payment provider did not complete the refund. Try again.",
    );
  }
}

async function runFreeAccess(request: ApprovalRequest) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const planId = text(request.payload, "plan_id");
  if (!planId) throw new ApprovalActionError("This request is missing a plan.");

  const startsAt =
    date(text(request.payload, "starts_at"), "start date") ??
    new Date().toISOString();
  const endsAt = date(text(request.payload, "ends_at"), "end date");
  await createBillingGrant({
    teamId,
    planId,
    startsAt,
    endsAt,
    note: request.reason,
  });
}

async function runInvoiceVoid(request: ApprovalRequest) {
  if (request.target_type !== "invoice") unsupported();
  const invoiceId = uuid(request.target_id, "invoice");
  const payloadInvoice = text(request.payload, "invoice_id");
  if (payloadInvoice && payloadInvoice !== invoiceId) {
    throw new ApprovalActionError(
      "The invoice in this request no longer matches the target.",
    );
  }
  await voidBillingInvoice(invoiceId, request.reason);
}

async function runPlanChange(request: ApprovalRequest) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const planId = text(request.payload, "plan_id");
  if (!planId) throw new ApprovalActionError("This request is missing a plan.");
  await setTeamPlan(teamId, planId, request.reason);
}

async function runAiCredits(request: ApprovalRequest) {
  if (!["team", "ai"].includes(request.target_type)) unsupported();
  const teamId = uuid(request.target_id, "team");
  const credits = integer(request.payload, ["credits", "amount_credits", "amount"]);
  if (credits === null || credits <= 0 || credits > 1_000_000) {
    throw new ApprovalActionError(
      "This request needs a credit amount between 1 and 1,000,000.",
    );
  }
  const expiresAt = date(text(request.payload, "expires_at"), "expiry date");
  const admin = createAdminClient();
  const { error } = await admin.rpc("grant_credits", {
    p_team: teamId,
    p_kind: "admin",
    p_amount: credits,
    p_expires: expiresAt,
    p_source: `approval:${request.id}`,
    p_note: request.reason,
  });
  if (error) {
    throw new ApprovalActionError("We could not add those AI credits.");
  }
}

async function runSiteTakedown(request: ApprovalRequest) {
  if (!["project", "website"].includes(request.target_type)) unsupported();
  const siteId = uuid(request.target_id, "website");

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("projects")
    .select("id, status, suspended_at")
    .eq("id", siteId)
    .maybeSingle();
  if (!before) throw new ApprovalActionError("We could not find that website.");
  if (before.suspended_at) return;

  const result = await takeSiteOffline(siteId, request.reason);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      throw new ApprovalActionError("We could not find that website.");
    }
    if (result.code === "NO_LIVE_VERSION") {
      throw new ApprovalActionError(
        "This website has no published version to take down.",
      );
    }
    throw new ApprovalActionError("We could not take that website down.");
  }
}

async function runSiteReinstate(request: ApprovalRequest, staffId: string) {
  if (!["project", "website"].includes(request.target_type)) unsupported();
  const siteId = uuid(request.target_id, "website");

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("projects")
    .select("id, status, suspended_at")
    .eq("id", siteId)
    .maybeSingle();
  if (!before) throw new ApprovalActionError("We could not find that website.");
  if (before.status === "published" && !before.suspended_at) return;

  const result = await bringSiteOnline(siteId, staffId);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      throw new ApprovalActionError("We could not find that website.");
    }
    if (result.code === "NO_LIVE_VERSION") {
      throw new ApprovalActionError(
        "This website has no published version to bring back.",
      );
    }
    throw new ApprovalActionError("We could not bring that website back.");
  }
}

async function runDomainReview(request: ApprovalRequest) {
  if (request.target_type !== "domain") unsupported();
  const domainId = uuid(request.target_id, "domain");
  const decision = text(request.payload, "decision").toLowerCase();
  if (["approve", "approved"].includes(decision)) {
    const result = await approveDomain(domainId);
    if (!result.ok) throw new ApprovalActionError(result.error);
    return;
  }
  if (["reject", "rejected"].includes(decision)) {
    const reason =
      text(request.payload, "reason") || request.reason;
    const result = await rejectDomain(domainId, reason);
    if (!result.ok) throw new ApprovalActionError(result.error);
    return;
  }
  throw new ApprovalActionError(
    "This request needs an approve or reject decision.",
  );
}

async function runDomainRemove(request: ApprovalRequest) {
  if (request.target_type !== "domain") unsupported();
  const domainId = uuid(request.target_id, "domain");

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("domains")
    .select("id, status")
    .eq("id", domainId)
    .maybeSingle();
  if (!before) throw new ApprovalActionError("We could not find that domain.");
  if (before.status === "removed") return;

  const result = await removeDomain(domainId);
  if (!result.ok) throw new ApprovalActionError(result.error);
}

async function dispatch(
  request: ApprovalRequest,
  staffId: string,
): Promise<void> {
  switch (request.kind as ApprovalKind) {
    case "refund":
      return runRefund(request, staffId);
    case "access_grant":
    case "free_access":
      return runFreeAccess(request);
    case "invoice_void":
      return runInvoiceVoid(request);
    case "plan_change":
      return runPlanChange(request);
    case "ai_credits":
      return runAiCredits(request);
    case "website_takedown":
      return runSiteTakedown(request);
    case "website_reinstate":
      return runSiteReinstate(request, staffId);
    case "domain_review":
      return runDomainReview(request);
    case "domain_remove":
      return runDomainRemove(request);
    default:
      return unsupported();
  }
}

function failureMessage(error: unknown): string {
  if (error instanceof ApprovalActionError) return error.message;
  if (error instanceof BillingError) return error.message;
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("APPROVAL_STALE") || raw.includes("APPROVAL_EXPIRED")) {
    return "The account changed since this was requested. Ask for a new approval.";
  }
  if (raw.includes("PAYMENT_NOT_REFUNDABLE")) {
    return "That payment can no longer be refunded.";
  }
  if (raw.includes("REFUND_TOO_LARGE")) {
    return "That is more than the unrefunded amount.";
  }
  if (raw.includes("PLAN_NOT_FOUND")) return "That plan is no longer available.";
  if (raw.includes("TEAM_NOT_FOUND")) return "We could not find that team.";
  if (raw.includes("NOTE_REQUIRED") || raw.includes("REASON_REQUIRED")) {
    return "Add a longer reason before trying again.";
  }
  return "We could not finish this action. Nothing else was changed.";
}

/**
 * Runs one approved request. Staff-checked RPCs use the approving Super
 * admin's session; only publishing, provider and credit operations use the
 * service role. The payload is treated as untrusted and checked against live
 * records before anything changes.
 */
export async function executeApproval(
  requestId: string,
  staffId: string,
): Promise<ApprovalExecutionResult> {
  const request = await getApprovalRequest(requestId);
  if (!request) return { ok: false, error: "We could not find that request." };
  if (request.status !== "approved") {
    return { ok: false, error: "This request is not ready to run." };
  }

  try {
    await beginApproval(requestId);
  } catch (error) {
    return { ok: false, error: failureMessage(error) };
  }

  try {
    await dispatch(request, staffId);
  } catch (error) {
    const message = failureMessage(error);
    await finishApproval(requestId, false, message).catch(() => undefined);
    return { ok: false, error: message };
  }

  try {
    await finishApproval(requestId, true);
  } catch {
    return {
      ok: false,
      error:
        "The action ran, but we could not update the request. Do not run it again.",
    };
  }
  return { ok: true };
}
