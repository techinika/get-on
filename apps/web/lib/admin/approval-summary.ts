import type { ApprovalKind } from "@get-on/permissions";
import { formatMoney } from "@/lib/billing/format";

export type ApprovalSummaryInput = {
  kind: ApprovalKind | string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
};

export type ApprovalPolicySummary = {
  label?: string | null;
  requires_second?: boolean | null;
  threshold_usd?: number | string | null;
  threshold_credits?: number | string | null;
};

const KIND_LABELS: Record<ApprovalKind, string> = {
  refund: "Refund a payment",
  manual_payment: "Record a manual payment",
  credit_adjust: "Adjust a credit balance",
  ai_credits: "Add AI credits",
  access_grant: "Give free access",
  free_access: "Give free access",
  invoice_void: "Void an invoice",
  grace_extend: "Extend grace time",
  billing_hold: "Place a billing hold",
  plan_change: "Change a plan",
  credits_limit: "Change an AI limit",
  website_takedown: "Take a website down",
  website_reinstate: "Bring a website back",
  website_plan_pause: "Pause a website for a plan",
  domain_review: "Decide a domain review",
  domain_plan_lapse: "Pause a domain for a plan",
  domain_remove: "Remove a custom address",
  account_delete: "Delete an account",
  template_publish: "Publish a system template",
};

const PAYLOAD_LABELS: Record<string, string> = {
  amount_cents: "Amount",
  amount_usd: "Amount",
  credits: "Credits",
  monthly_credits: "Monthly credits",
  member_name: "Member",
  payment_id: "Payment reference",
  team_id: "Team reference",
  project_id: "Website reference",
  domain_id: "Domain reference",
  invoice_id: "Invoice reference",
  invoice_number: "Invoice number",
  plan_id: "Plan",
  team_name: "Team",
  site_name: "Website",
  hostname: "Address",
  member_id: "Member reference",
  starts_at: "Starts",
  ends_at: "Ends",
  expires_at: "Expires",
  days: "Days",
  action: "Action",
  decision: "Decision",
  note: "Note",
  reason: "Reason",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimal(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function approvalKindLabel(kind: string): string {
  return KIND_LABELS[kind as ApprovalKind] ?? "Staff action";
}

export function shortReference(value: string): string {
  const clean = value.trim();
  if (clean.length <= 10) return clean || "unknown";
  return `${clean.slice(0, 8)}…`;
}

export function approvalTarget(input: ApprovalSummaryInput): string {
  const payload = input.payload ?? {};
  const name =
    text(payload.team_name) ||
    text(payload.site_name) ||
    text(payload.hostname) ||
    text(payload.invoice_number);
  if (name) return name;

  const labels: Record<string, string> = {
    team: "Team",
    project: "Website",
    website: "Website",
    domain: "Domain",
    invoice: "Invoice",
    payment: "Payment",
    ai: "AI member",
    staff: "Staff member",
    account: "Account",
  };
  const label = labels[input.target_type] ?? "Record";
  return `${label} ${shortReference(input.target_id)}`;
}

export function approvalAmount(input: ApprovalSummaryInput): string {
  const payload = input.payload ?? {};
  const cents = integer(payload.amount_cents);
  if (cents !== null && cents > 0) return formatMoney(cents);
  const usd = decimal(payload.amount_usd);
  if (usd !== null && usd > 0) return formatMoney(Math.round(usd * 100));
  const monthly = integer(payload.monthly_credits);
  if (monthly !== null && monthly >= 0) {
    return `${monthly.toLocaleString("en-US")} AI credits a month`;
  }
  const credits = integer(payload.credits);
  if (credits !== null && credits > 0) return `${credits.toLocaleString("en-US")} AI credits`;
  const plan = text(payload.plan_id);
  if (plan) return plan;
  return "—";
}

export function approvalSummary(input: ApprovalSummaryInput): string {
  const target = approvalTarget(input);
  const payload = input.payload ?? {};
  const amount = approvalAmount(input);

  switch (input.kind) {
    case "refund":
      return `Refund ${amount === "—" ? "a payment" : amount} to ${target}.`;
    case "manual_payment":
      return `Record ${amount === "—" ? "a manual payment" : amount} for ${target}.`;
    case "credit_adjust":
      return `Adjust the credit balance for ${target} by ${amount}.`;
    case "ai_credits":
      return `Add ${amount === "—" ? "AI credits" : amount} to ${target}.`;
    case "access_grant":
    case "free_access":
      return `Give ${target} free access to the ${text(payload.plan_id) || "chosen"} plan.`;
    case "invoice_void":
      return `Void invoice ${target}.`;
    case "grace_extend":
      return `Extend grace time for ${target} by ${text(payload.days) || "the requested number of"} days.`;
    case "billing_hold":
      return `${
        text(payload.action) === "release" ? "Release" : "Place"
      } a billing hold on ${target}.`;
    case "plan_change":
      return `Move ${target} to the ${text(payload.plan_id) || "chosen"} plan.`;
    case "credits_limit": {
      const limit = integer(payload.monthly_credits);
      return `Set the monthly AI limit for ${text(payload.member_name) || target} to ${
        limit === null ? "the requested amount" : limit.toLocaleString("en-US")
      } credits.`;
    }
    case "website_takedown":
      return `Take ${target} down.`;
    case "website_reinstate":
      return `Bring ${target} back online.`;
    case "website_plan_pause":
      return `Pause ${target} because its plan lapsed.`;
    case "domain_review":
      return `${text(payload.decision) === "reject" ? "Reject" : "Approve"} the review for ${target}.`;
    case "domain_plan_lapse":
      return `Pause ${target} because its plan lapsed.`;
    case "domain_remove":
      return `Remove ${target} from its website.`;
    case "account_delete":
      return `Delete the account for ${target}.`;
    case "template_publish":
      return "Publish a change to the system templates.";
    default:
      return "A staff action needs a decision.";
  }
}

function formatPayloadValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "amount_cents") {
    const cents = integer(value);
    return cents === null ? null : formatMoney(cents);
  }
  if (key === "amount_usd") {
    const usd = decimal(value);
    return usd === null ? null : formatMoney(Math.round(usd * 100));
  }
  if (key === "credits") {
    const credits = integer(value);
    return credits === null ? null : credits.toLocaleString("en-US");
  }
  if (key.endsWith("_at")) {
    const raw = text(value);
    if (!raw) return null;
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  if (key.endsWith("_id")) return shortReference(text(value));
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value === "string") return value;
  return null;
}

export function approvalPayloadLines(
  input: Pick<ApprovalSummaryInput, "payload">,
): { label: string; value: string }[] {
  const payload = input.payload ?? {};
  return Object.entries(PAYLOAD_LABELS).flatMap(([key, label]) => {
    const value = formatPayloadValue(key, payload[key]);
    return value === null ? [] : [{ label, value }];
  });
}

export function approvalThreshold(
  policy: ApprovalPolicySummary | null | undefined,
  input: { singleOperator?: boolean } = {},
): string {
  if (input.singleOperator) {
    return "One Super admin is deciding this because no second Super admin is available.";
  }
  const usd = decimal(policy?.threshold_usd);
  if (usd !== null) {
    return `A second Super admin is needed above ${formatMoney(Math.round(usd * 100))}.`;
  }
  const credits = integer(policy?.threshold_credits);
  if (credits !== null) {
    return `A second Super admin is needed above ${credits.toLocaleString("en-US")} AI credits.`;
  }
  if (policy?.requires_second) return "Two Super admins must agree.";
  return "One Super admin can decide this.";
}

const EXECUTABLE_KINDS = new Set<ApprovalKind>([
  "refund",
  "manual_payment",
  "access_grant",
  "free_access",
  "invoice_void",
  "plan_change",
  "ai_credits",
  "credits_limit",
  "grace_extend",
  "billing_hold",
  "website_plan_pause",
  "website_takedown",
  "website_reinstate",
  "domain_review",
  "domain_remove",
  "domain_plan_lapse",
]);

export function approvalHasExecutor(kind: string): boolean {
  return EXECUTABLE_KINDS.has(kind as ApprovalKind);
}
