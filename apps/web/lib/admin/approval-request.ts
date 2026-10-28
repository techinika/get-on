import { PLAN_IDS } from "@get-on/billing";
import type { ApprovalKind } from "@get-on/permissions";

export type ApprovalRequestExtra =
  | "refund_amount"
  | "payment_amount"
  | "credits"
  | "ai_limit"
  | "plan"
  | "plan_dates"
  | "domain_decision"
  | "days"
  | "hold"
  | "none";

export type ApprovalRequestKind = {
  kind: ApprovalKind;
  label: string;
  description: string;
  targetType: "team" | "project" | "invoice" | "payment" | "domain" | "ai";
  targetLabel: string;
  targetHint: string;
  extra: ApprovalRequestExtra;
};

export const APPROVAL_REQUEST_KINDS: ApprovalRequestKind[] = [
  {
    kind: "refund",
    label: "Refund a payment",
    description: "Send money back to a customer.",
    targetType: "payment",
    targetLabel: "Payment ID",
    targetHint: "Copy the payment ID from the team's billing screen.",
    extra: "refund_amount",
  },
  {
    kind: "manual_payment",
    label: "Record a manual payment",
    description: "Mark an invoice paid outside the provider.",
    targetType: "invoice",
    targetLabel: "Invoice ID",
    targetHint: "Copy the invoice ID from the team's billing screen.",
    extra: "payment_amount",
  },
  {
    kind: "access_grant",
    label: "Give free access",
    description: "Let a team use a paid plan without payment.",
    targetType: "team",
    targetLabel: "Team ID",
    targetHint: "Copy the team ID from the team's account screen.",
    extra: "plan_dates",
  },
  {
    kind: "invoice_void",
    label: "Void an invoice",
    description: "Cancel an invoice before it is paid.",
    targetType: "invoice",
    targetLabel: "Invoice ID",
    targetHint: "Copy the invoice ID from the team's billing screen.",
    extra: "none",
  },
  {
    kind: "plan_change",
    label: "Change a plan",
    description: "Move a team to another plan by hand.",
    targetType: "team",
    targetLabel: "Team ID",
    targetHint: "Copy the team ID from the team's account screen.",
    extra: "plan",
  },
  {
    kind: "ai_credits",
    label: "Add AI credits",
    description: "Top up a team's AI balance.",
    targetType: "team",
    targetLabel: "Team ID",
    targetHint: "Copy the team ID from the team's AI screen.",
    extra: "credits",
  },
  {
    kind: "credits_limit",
    label: "Change an AI limit",
    description: "Set one member's monthly AI allowance.",
    targetType: "ai",
    targetLabel: "Member user ID",
    targetHint: "Copy the member user ID from the team screen.",
    extra: "ai_limit",
  },
  {
    kind: "website_takedown",
    label: "Take a website down",
    description: "Suspend a published website.",
    targetType: "project",
    targetLabel: "Website ID",
    targetHint: "Copy the website ID from the websites list.",
    extra: "none",
  },
  {
    kind: "website_reinstate",
    label: "Bring a website back",
    description: "Restore a suspended website.",
    targetType: "project",
    targetLabel: "Website ID",
    targetHint: "Copy the website ID from the websites list.",
    extra: "none",
  },
  {
    kind: "grace_extend",
    label: "Extend grace time",
    description: "Keep a team online beyond the normal grace window.",
    targetType: "team",
    targetLabel: "Team ID",
    targetHint: "Copy the team ID from the team's billing screen.",
    extra: "days",
  },
  {
    kind: "billing_hold",
    label: "Place or release a billing hold",
    description: "Stop billing reminders while a case is open.",
    targetType: "team",
    targetLabel: "Team ID",
    targetHint: "Copy the team ID from the team's billing screen.",
    extra: "hold",
  },
  {
    kind: "website_plan_pause",
    label: "Pause a website for a plan",
    description: "Keep the live website visible but stop new publishes.",
    targetType: "project",
    targetLabel: "Website ID",
    targetHint: "Copy the website ID from the websites list.",
    extra: "none",
  },
  {
    kind: "domain_plan_lapse",
    label: "Pause a custom address for a plan",
    description: "Pause one custom address because its plan lapsed.",
    targetType: "domain",
    targetLabel: "Domain ID",
    targetHint: "Copy the domain ID from the domains list.",
    extra: "none",
  },
  {
    kind: "domain_review",
    label: "Decide a domain review",
    description: "Approve or reject a custom address under review.",
    targetType: "domain",
    targetLabel: "Domain ID",
    targetHint: "Copy the domain ID from the domains list.",
    extra: "domain_decision",
  },
  {
    kind: "domain_remove",
    label: "Remove a custom address",
    description: "Take a custom address away from a website.",
    targetType: "domain",
    targetLabel: "Domain ID",
    targetHint: "Copy the domain ID from the domains list.",
    extra: "none",
  },
];

const KIND_BY_ID = new Map(
  APPROVAL_REQUEST_KINDS.map((config) => [config.kind, config] as const),
);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MONEY = /^[0-9]+(?:\.[0-9]{1,2})?$/;

export function requestApprovalHref(input: {
  kind: ApprovalKind;
  targetId?: string;
  amountUsd?: number;
  planId?: string;
  decision?: "approve" | "reject";
}): string {
  const params = new URLSearchParams({ kind: input.kind });
  if (input.targetId) params.set("target_id", input.targetId);
  if (input.amountUsd && input.amountUsd > 0) {
    params.set("amount_usd", String(input.amountUsd));
  }
  if (input.planId) params.set("plan_id", input.planId);
  if (input.decision) params.set("decision", input.decision);
  return `/admin/approvals/new?${params.toString()}`;
}

export type ApprovalRequestInput = {
  kind: string;
  targetId: string;
  reason: string;
  amountUsd?: string;
  amountCredits?: string;
  teamId?: string;
  monthlyCredits?: string;
  days?: string;
  holdAction?: string;
  planId?: string;
  startsAt?: string;
  endsAt?: string;
  expiresAt?: string;
  decision?: string;
};

export type ApprovalRequestValue = {
  kind: ApprovalKind;
  targetType: ApprovalRequestKind["targetType"];
  targetId: string;
  reason: string;
  payload: Record<string, unknown>;
  amountUsd: number | null;
  amountCredits: number | null;
};

export type ApprovalRequestBuild =
  | { ok: true; value: ApprovalRequestValue }
  | { ok: false; error: string };

export function approvalRequestKind(kind: string): ApprovalRequestKind | null {
  return KIND_BY_ID.get(kind as ApprovalKind) ?? null;
}

export function buildApprovalRequest(
  input: ApprovalRequestInput,
): ApprovalRequestBuild {
  const config = approvalRequestKind(input.kind);
  if (!config) {
    return { ok: false, error: "Choose an action." };
  }

  const targetId = clean(input.targetId);
  if (!UUID.test(targetId)) {
    return { ok: false, error: `Add a valid ${config.targetLabel.toLowerCase()}.` };
  }

  const reason = clean(input.reason);
  if (reason.length < 10 || reason.length > 500) {
    return {
      ok: false,
      error: "Add a reason between 10 and 500 characters.",
    };
  }

  const payload: Record<string, unknown> = {};
  let amountUsd: number | null = null;
  let amountCredits: number | null = null;

  if (config.extra === "refund_amount" || config.extra === "payment_amount") {
    const raw = clean(input.amountUsd);
    if (!MONEY.test(raw)) {
      return {
        ok: false,
        error:
          config.extra === "refund_amount"
            ? "Add a refund amount greater than zero."
            : "Add a payment amount greater than zero.",
      };
    }
    const usd = Number(raw);
    const cents = Math.round(usd * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > 100_000_000) {
      return { ok: false, error: "Add an amount between $0.01 and $1,000,000." };
    }
    amountUsd = cents / 100;
    if (config.extra === "refund_amount") payload.payment_id = targetId;
    else payload.invoice_id = targetId;
    payload.amount_cents = cents;
  }

  if (config.extra === "plan" || config.extra === "plan_dates") {
    const planId = clean(input.planId);
    if (!PLAN_IDS.includes(planId as (typeof PLAN_IDS)[number])) {
      return { ok: false, error: "Choose a plan." };
    }
    payload.plan_id = planId;
  }

  if (config.extra === "plan_dates") {
    const startsAt = date(input.startsAt);
    if (startsAt.error) return { ok: false, error: startsAt.error };
    const endsAt = date(input.endsAt);
    if (endsAt.error) return { ok: false, error: endsAt.error };
    if (startsAt.value) payload.starts_at = startsAt.value;
    if (endsAt.value) payload.ends_at = endsAt.value;
    if (
      startsAt.value &&
      endsAt.value &&
      new Date(endsAt.value).getTime() <= new Date(startsAt.value).getTime()
    ) {
      return { ok: false, error: "The end date must be after the start date." };
    }
  }

  if (config.extra === "credits") {
    const raw = clean(input.amountCredits);
    if (!/^[0-9]+$/.test(raw)) {
      return { ok: false, error: "Add a whole number of credits." };
    }
    const credits = Number(raw);
    if (!Number.isSafeInteger(credits) || credits <= 0 || credits > 1_000_000) {
      return {
        ok: false,
        error: "Add between 1 and 1,000,000 credits.",
      };
    }
    const expiresAt = date(input.expiresAt);
    if (expiresAt.error) return { ok: false, error: expiresAt.error };
    amountCredits = credits;
    payload.credits = credits;
    if (expiresAt.value) payload.expires_at = expiresAt.value;
  }

  if (config.extra === "ai_limit") {
    const teamId = clean(input.teamId);
    if (!UUID.test(teamId)) {
      return { ok: false, error: "Add a valid team ID." };
    }
    const raw = clean(input.monthlyCredits);
    if (!/^[0-9]+$/.test(raw)) {
      return { ok: false, error: "Add a whole number of monthly credits." };
    }
    const limit = Number(raw);
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 1_000_000) {
      return {
        ok: false,
        error: "Add a monthly limit between 0 and 1,000,000 credits.",
      };
    }
    payload.team_id = teamId;
    payload.member_id = targetId;
    payload.monthly_credits = limit;
  }

  if (config.extra === "days") {
    const raw = clean(input.days);
    if (!/^[0-9]+$/.test(raw)) {
      return { ok: false, error: "Add a whole number of days." };
    }
    const days = Number(raw);
    if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
      return { ok: false, error: "Add between 1 and 365 days." };
    }
    payload.team_id = targetId;
    payload.days = days;
  }

  if (config.extra === "hold") {
    const action = clean(input.holdAction) || "place";
    if (!["place", "release"].includes(action)) {
      return { ok: false, error: "Choose whether to place or release the hold." };
    }
    payload.team_id = targetId;
    payload.action = action;
    const raw = clean(input.days);
    if (raw) {
      if (!/^[0-9]+$/.test(raw)) {
        return { ok: false, error: "Add a whole number of days." };
      }
      const days = Number(raw);
      if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
        return { ok: false, error: "Add between 1 and 365 days." };
      }
      payload.days = days;
    }
  }

  if (config.kind === "website_plan_pause") {
    payload.project_id = targetId;
  }

  if (config.extra === "domain_decision") {
    const decision = clean(input.decision).toLowerCase();
    if (!["approve", "reject"].includes(decision)) {
      return { ok: false, error: "Choose whether to approve or reject the domain." };
    }
    payload.decision = decision;
  }

  return {
    ok: true,
    value: {
      kind: config.kind,
      targetType: config.targetType,
      targetId,
      reason,
      payload,
      amountUsd,
      amountCredits,
    },
  };
}

function clean(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: string | undefined): { value: string | null; error: string | null } {
  const raw = clean(value);
  if (!raw) return { value: null, error: null };
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return { value: null, error: "Add a valid date." };
  }
  return { value: parsed.toISOString(), error: null };
}
