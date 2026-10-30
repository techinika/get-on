import { createAdminClient } from "@/lib/supabase/admin";
import {
  beginApproval,
  finishApproval,
  getApprovalRequest,
  type ApprovalKind,
  type ApprovalRequest,
} from "@/lib/admin/approvals";
import {
  extendBillingGrace,
  publishSystemTemplate,
  recordStaffAction,
  setBillingHold,
  setMemberAiLimit,
  setTeamPlan,
} from "@/lib/admin/access";
import { createBillingGrant, voidBillingInvoice } from "@/lib/admin/screens";
import { adjustBillingCredit, BillingError, refundPayment } from "@/lib/billing/service";
import {
  approveDomain,
  pauseDomainForPlan,
  rejectDomain,
  removeDomain,
} from "@/lib/domains/admin-actions";
import {
  bringSiteOnline,
  pauseSiteForPlan,
  takeSiteOffline,
} from "@/lib/admin-actions/site";

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

async function runManualPayment(request: ApprovalRequest, staffId: string) {
  if (request.target_type !== "invoice") unsupported();
  const invoiceId = uuid(request.target_id, "invoice");
  const payloadInvoice = text(request.payload, "invoice_id");
  if (payloadInvoice && payloadInvoice !== invoiceId) {
    throw new ApprovalActionError(
      "The invoice in this request no longer matches the target.",
    );
  }
  const amountCents = integer(request.payload, ["amount_cents"]);
  if (amountCents === null || amountCents <= 0) {
    throw new ApprovalActionError("This request is missing a payment amount.");
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("id, team_id, status, total_cents, currency")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    throw new ApprovalActionError("We could not find that invoice.");
  }

  const reference = `manual:${request.id}`;
  if (invoice.status === "paid") {
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (payment) return;
    throw new ApprovalActionError("That invoice is already paid.");
  }
  if (!["open", "payment_pending"].includes(String(invoice.status))) {
    throw new ApprovalActionError("That invoice can no longer be paid.");
  }
  if (String(invoice.currency).toUpperCase() !== "USD") {
    throw new ApprovalActionError(
      "Manual payments are only available for USD invoices.",
    );
  }
  if (amountCents !== Number(invoice.total_cents)) {
    throw new ApprovalActionError(
      "The payment must match the invoice total exactly.",
    );
  }

  const { data: attempt } = await admin
    .from("payment_attempts")
    .select("id")
    .eq("merchant_reference", reference)
    .maybeSingle();
  if (!attempt) {
    const { error: attemptError } = await admin.from("payment_attempts").insert({
      team_id: invoice.team_id,
      invoice_id: invoice.id,
      provider: "manual",
      merchant_reference: reference,
      amount_cents: amountCents,
      currency: "USD",
      status: "pending",
      created_by: staffId,
      metadata: { approval_id: request.id },
    });
    if (attemptError) {
      throw new ApprovalActionError("We could not prepare that manual payment.");
    }
  }

  const { data, error } = await admin.rpc("billing_confirm_payment", {
    p_provider: "manual",
    p_provider_reference: reference,
    p_merchant_reference: reference,
    p_amount_cents: amountCents,
    p_currency: "USD",
    p_method: "manual",
    p_confirmation_code: null,
    p_paid_at: new Date().toISOString(),
    p_event_key: reference,
    p_event_type: "MANUAL",
    p_summary: { approval_id: request.id, staff_user_id: staffId },
  });
  if (error) {
    throw new ApprovalActionError("We could not record that payment.");
  }
  const status = String((data as { status?: unknown } | null)?.status ?? "");
  if (!["confirmed", "duplicate"].includes(status)) {
    throw new ApprovalActionError("That invoice could not be marked paid.");
  }
  if (status === "duplicate") {
    const { data: payment } = await admin
      .from("payments")
      .select("id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (!payment) {
      throw new ApprovalActionError("That invoice is already paid.");
    }
  }

  await recordStaffAction({
    action: "billing.manual_payment_recorded",
    targetType: "invoice",
    targetId: invoiceId,
    reason: request.reason,
    approvalId: request.id,
    details: {
      team_id: invoice.team_id,
      amount_cents: amountCents,
      provider_reference: reference,
    },
  }).catch(() => undefined);
}

async function runCreditAdjust(request: ApprovalRequest, staffId: string) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const payloadTeam = text(request.payload, "team_id");
  if (payloadTeam && payloadTeam !== teamId) {
    throw new ApprovalActionError(
      "The team in this request no longer matches the target.",
    );
  }
  const amountCents = integer(request.payload, ["amount_cents"]);
  if (amountCents === null || amountCents === 0 || Math.abs(amountCents) > 100_000_000) {
    throw new ApprovalActionError(
      "This request needs a credit amount between $0.01 and $1,000,000.",
    );
  }

  const result = await adjustBillingCredit({
    teamId,
    amountCents,
    source: `approval:${request.id}`,
    note: request.reason,
    approvalId: request.id,
    createdBy: staffId,
  });
  if (result.duplicate) return;

  await recordStaffAction({
    action: "billing.credit_adjusted",
    targetType: "team",
    targetId: teamId,
    reason: request.reason,
    approvalId: request.id,
    details: {
      team_id: teamId,
      amount_cents: amountCents,
      balance_cents: result.balanceCents,
    },
  }).catch(() => undefined);
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

async function runGraceExtend(request: ApprovalRequest) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const payloadTeam = text(request.payload, "team_id");
  if (payloadTeam && payloadTeam !== teamId) {
    throw new ApprovalActionError(
      "The team in this request no longer matches the target.",
    );
  }
  const days = integer(request.payload, ["days"]);
  if (days === null || days < 1 || days > 365) {
    throw new ApprovalActionError(
      "This request needs a number of days between 1 and 365.",
    );
  }
  await extendBillingGrace({
    teamId,
    days,
    reason: request.reason,
    approvalId: request.id,
  });
}

async function runBillingHold(request: ApprovalRequest) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const payloadTeam = text(request.payload, "team_id");
  if (payloadTeam && payloadTeam !== teamId) {
    throw new ApprovalActionError(
      "The team in this request no longer matches the target.",
    );
  }
  const action = text(request.payload, "action") || "place";
  if (!["place", "release"].includes(action)) {
    throw new ApprovalActionError("This request needs a hold action.");
  }
  const days = integer(request.payload, ["days"]);
  if (action === "place" && days !== null && (days < 1 || days > 365)) {
    throw new ApprovalActionError("A hold must be between 1 and 365 days.");
  }
  await setBillingHold({
    teamId,
    action: action as "place" | "release",
    reason: request.reason,
    days: action === "place" ? days : null,
    approvalId: request.id,
  });
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

async function runCreditsLimit(request: ApprovalRequest) {
  if (request.target_type !== "ai") unsupported();
  const memberId = uuid(request.target_id, "member");
  const teamId = uuid(text(request.payload, "team_id"), "team");
  const payloadMember = text(request.payload, "member_id");
  if (payloadMember && payloadMember !== memberId) {
    throw new ApprovalActionError(
      "The member in this request no longer matches the target.",
    );
  }
  const limit = integer(request.payload, ["monthly_credits", "credits"]);
  if (limit === null || limit < 0 || limit > 1_000_000) {
    throw new ApprovalActionError(
      "This request needs a monthly limit between 0 and 1,000,000 credits.",
    );
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("user_id", memberId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) {
    throw new ApprovalActionError("That member is no longer in this team.");
  }

  await setMemberAiLimit({
    teamId,
    memberId,
    monthlyCredits: limit,
    note: request.reason,
    approvalId: request.id,
  });
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

async function runSitePlanPause(request: ApprovalRequest) {
  if (!["project", "website"].includes(request.target_type)) unsupported();
  const siteId = uuid(request.target_id, "website");
  const payloadSite = text(request.payload, "project_id");
  if (payloadSite && payloadSite !== siteId) {
    throw new ApprovalActionError(
      "The website in this request no longer matches the target.",
    );
  }

  const result = await pauseSiteForPlan(siteId, request.reason);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      throw new ApprovalActionError("We could not find that website.");
    }
    if (result.code === "NO_LIVE_VERSION") {
      throw new ApprovalActionError(
        "This website has no published version to pause.",
      );
    }
    if (result.code === "SUSPENDED") {
      throw new ApprovalActionError(
        "Take the website back online before pausing it for a plan.",
      );
    }
    throw new ApprovalActionError("We could not pause that website.");
  }

  await recordStaffAction({
    action: "website.plan_paused",
    targetType: "project",
    targetId: siteId,
    reason: request.reason,
    approvalId: request.id,
  }).catch(() => undefined);
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

async function runDomainPlanLapse(request: ApprovalRequest) {
  if (request.target_type !== "domain") unsupported();
  const domainId = uuid(request.target_id, "domain");
  const payloadDomain = text(request.payload, "domain_id");
  if (payloadDomain && payloadDomain !== domainId) {
    throw new ApprovalActionError(
      "The domain in this request no longer matches the target.",
    );
  }

  const result = await pauseDomainForPlan(domainId);
  if (!result.ok) throw new ApprovalActionError(result.error);
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

async function runAccountDelete(request: ApprovalRequest) {
  if (request.target_type !== "team") unsupported();
  const teamId = uuid(request.target_id, "team");
  const payloadTeam = text(request.payload, "team_id");
  if (payloadTeam && payloadTeam !== teamId) {
    throw new ApprovalActionError(
      "The team in this request no longer matches the target.",
    );
  }

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("id, owner_id, name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) throw new ApprovalActionError("We could not find that team.");

  const { data, error } = await admin.rpc("admin_delete_account", {
    p_team: teamId,
    p_reason: request.reason,
  });
  if (error) {
    if (error.message.includes("ACCOUNT_IS_STAFF")) {
      throw new ApprovalActionError(
        "That account belongs to a staff member and cannot be deleted here.",
      );
    }
    throw new ApprovalActionError("We could not delete that account.");
  }

  const ownerId = String((data as { owner_id?: unknown } | null)?.owner_id ?? "");
  if (ownerId) {
    await admin.auth.admin.deleteUser(ownerId).catch(() => undefined);
  }

  await recordStaffAction({
    action: "account.deleted",
    targetType: "team",
    targetId: teamId,
    reason: request.reason,
    approvalId: request.id,
    details: { team_id: teamId, owner_id: ownerId },
  }).catch(() => undefined);
}

async function runTemplatePublish(request: ApprovalRequest) {
  if (request.target_type !== "template") unsupported();
  const templateId = uuid(request.target_id, "template");
  const payloadTemplate = text(request.payload, "template_id");
  if (payloadTemplate && payloadTemplate !== templateId) {
    throw new ApprovalActionError(
      "The template in this request no longer matches the target.",
    );
  }
  const versionId = uuid(text(request.payload, "version_id"), "template version");
  const payloadHash = text(request.payload, "package_hash");

  const admin = createAdminClient();
  const { data: template } = await admin
    .from("templates")
    .select("id, kind, status, current_version_id")
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!template || template.kind !== "system") {
    throw new ApprovalActionError("We could not find that system template.");
  }

  const { data: version } = await admin
    .from("template_versions")
    .select("id, template_id, version, package_hash")
    .eq("id", versionId)
    .maybeSingle();
  if (!version || version.template_id !== templateId) {
    throw new ApprovalActionError(
      "That version does not belong to this template.",
    );
  }
  if (
    (payloadHash && payloadHash !== version.package_hash) ||
    (request.state_hash && request.state_hash !== version.package_hash)
  ) {
    throw new ApprovalActionError(
      "The template changed since this was requested. Ask for a new approval.",
    );
  }
  if (
    template.status === "published" &&
    template.current_version_id === versionId
  ) {
    return;
  }

  const result = await publishSystemTemplate({
    templateId,
    versionId,
    reason: request.reason,
    approvalId: request.id,
  });
  if (result.duplicate) return;

  await recordStaffAction({
    action: "template.published",
    targetType: "template",
    targetId: templateId,
    reason: request.reason,
    approvalId: request.id,
    details: { version: version.version, package_hash: version.package_hash },
  }).catch(() => undefined);
}

async function dispatch(
  request: ApprovalRequest,
  staffId: string,
): Promise<void> {
  switch (request.kind as ApprovalKind) {
    case "refund":
      return runRefund(request, staffId);
    case "manual_payment":
      return runManualPayment(request, staffId);
    case "credit_adjust":
      return runCreditAdjust(request, staffId);
    case "access_grant":
    case "free_access":
      return runFreeAccess(request);
    case "invoice_void":
      return runInvoiceVoid(request);
    case "plan_change":
      return runPlanChange(request);
    case "ai_credits":
      return runAiCredits(request);
    case "credits_limit":
      return runCreditsLimit(request);
    case "grace_extend":
      return runGraceExtend(request);
    case "billing_hold":
      return runBillingHold(request);
    case "website_takedown":
      return runSiteTakedown(request);
    case "website_reinstate":
      return runSiteReinstate(request, staffId);
    case "website_plan_pause":
      return runSitePlanPause(request);
    case "domain_review":
      return runDomainReview(request);
    case "domain_remove":
      return runDomainRemove(request);
    case "domain_plan_lapse":
      return runDomainPlanLapse(request);
    case "account_delete":
      return runAccountDelete(request);
    case "template_publish":
      return runTemplatePublish(request);
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
  if (raw.includes("TEMPLATE_NOT_FOUND")) {
    return "We could not find that system template.";
  }
  if (raw.includes("TEMPLATE_VERSION_NOT_FOUND")) {
    return "We could not find that template version.";
  }
  if (raw.includes("TEMPLATE_SLUG_INVALID")) {
    return "That template name cannot be saved.";
  }
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
