import { describe, expect, it } from "vitest";
import {
  APPROVAL_REQUEST_KINDS,
  approvalRequestKind,
  buildApprovalRequest,
  requestApprovalHref,
} from "@/lib/admin/approval-request";

const target = "11111111-1111-4111-8111-111111111111";
const reason = "Duplicate charge confirmed with the payment provider.";

describe("approval request builder", () => {
  it("only offers actions the executor can finish", () => {
    const kinds = APPROVAL_REQUEST_KINDS.map((item) => item.kind);
    expect(kinds).toContain("refund");
    expect(kinds).toContain("domain_remove");
    expect(kinds).toContain("credits_limit");
    expect(kinds).toContain("domain_plan_lapse");
    expect(kinds).toContain("manual_payment");
    expect(kinds).toContain("credit_adjust");
    expect(kinds).toContain("grace_extend");
    expect(kinds).toContain("billing_hold");
    expect(kinds).toContain("website_plan_pause");
    expect(kinds).toContain("template_publish");
    expect(kinds).toContain("account_delete");
    expect(approvalRequestKind("refund")?.targetType).toBe("payment");
    expect(approvalRequestKind("credits_limit")?.targetType).toBe("ai");
    expect(approvalRequestKind("template_publish")?.targetType).toBe("template");
  });

  it("builds a template publish request with its version", () => {
    const version = "33333333-3333-4333-8333-333333333333";
    const result = buildApprovalRequest({
      kind: "template_publish",
      targetId: target,
      versionId: version,
      reason,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "template_publish",
        targetType: "template",
        targetId: target,
        reason,
        payload: { template_id: target, version_id: version },
        amountUsd: null,
        amountCredits: null,
      },
    });

    expect(
      buildApprovalRequest({
        kind: "template_publish",
        targetId: target,
        reason,
      }).ok,
    ).toBe(false);
  });

  it("builds a refund with cents and the dual-control amount", () => {
    const result = buildApprovalRequest({
      kind: "refund",
      targetId: target,
      reason,
      amountUsd: "200.50",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "refund",
        targetType: "payment",
        targetId: target,
        reason,
        payload: {
          payment_id: target,
          amount_cents: 20050,
        },
        amountUsd: 200.5,
        amountCredits: null,
      },
    });
  });

  it("builds a manual payment for the invoice total", () => {
    const result = buildApprovalRequest({
      kind: "manual_payment",
      targetId: target,
      reason,
      amountUsd: "79.99",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "manual_payment",
        targetType: "invoice",
        targetId: target,
        reason,
        payload: { invoice_id: target, amount_cents: 7999 },
        amountUsd: 79.99,
        amountCredits: null,
      },
    });
  });

  it("builds a credit adjustment with cents", () => {
    const credit = buildApprovalRequest({
      kind: "credit_adjust",
      targetId: target,
      reason,
      amountUsd: "150",
    });
    expect(credit).toEqual({
      ok: true,
      value: {
        kind: "credit_adjust",
        targetType: "team",
        targetId: target,
        reason,
        payload: { team_id: target, amount_cents: 15000 },
        amountUsd: 150,
        amountCredits: null,
      },
    });
  });

  it("builds an account deletion request", () => {
    const result = buildApprovalRequest({
      kind: "account_delete",
      targetId: target,
      reason,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "account_delete",
        targetType: "team",
        targetId: target,
        reason,
        payload: {},
        amountUsd: null,
        amountCredits: null,
      },
    });
  });

  it("builds free access with plan and dates", () => {
    const result = buildApprovalRequest({
      kind: "access_grant",
      targetId: target,
      reason,
      planId: "pro",
      startsAt: "2026-11-01T09:00:00.000Z",
      endsAt: "2026-12-01T09:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.targetType).toBe("team");
    expect(result.value.payload.plan_id).toBe("pro");
    expect(result.value.payload.starts_at).toBe("2026-11-01T09:00:00.000Z");
    expect(result.value.payload.ends_at).toBe("2026-12-01T09:00:00.000Z");
  });

  it("builds AI credits and a domain decision", () => {
    const credits = buildApprovalRequest({
      kind: "ai_credits",
      targetId: target,
      reason,
      amountCredits: "1500",
    });
    expect(credits.ok && credits.value.amountCredits).toBe(1500);

    const domain = buildApprovalRequest({
      kind: "domain_review",
      targetId: target,
      reason,
      decision: "reject",
    });
    expect(domain.ok && domain.value.payload.decision).toBe("reject");
  });

  it("builds a member AI limit and a plan-lapse domain pause", () => {
    const team = "22222222-2222-4222-8222-222222222222";
    const limit = buildApprovalRequest({
      kind: "credits_limit",
      targetId: target,
      teamId: team,
      monthlyCredits: "0",
      reason,
    });
    expect(limit.ok).toBe(true);
    if (!limit.ok) return;
    expect(limit.value.targetType).toBe("ai");
    expect(limit.value.payload).toEqual({
      team_id: team,
      member_id: target,
      monthly_credits: 0,
    });

    const domain = buildApprovalRequest({
      kind: "domain_plan_lapse",
      targetId: target,
      reason,
    });
    expect(domain.ok).toBe(true);
    if (!domain.ok) return;
    expect(domain.value.targetType).toBe("domain");
    expect(domain.value.payload).toEqual({});
  });

  it("builds grace, billing hold and website plan pause requests", () => {
    const grace = buildApprovalRequest({
      kind: "grace_extend",
      targetId: target,
      reason,
      days: "14",
    });
    expect(grace.ok).toBe(true);
    if (!grace.ok) return;
    expect(grace.value.payload).toEqual({ team_id: target, days: 14 });

    const hold = buildApprovalRequest({
      kind: "billing_hold",
      targetId: target,
      reason,
      holdAction: "place",
      days: "30",
    });
    expect(hold.ok).toBe(true);
    if (!hold.ok) return;
    expect(hold.value.payload).toEqual({
      team_id: target,
      action: "place",
      days: 30,
    });

    const release = buildApprovalRequest({
      kind: "billing_hold",
      targetId: target,
      reason,
      holdAction: "release",
    });
    expect(release.ok && release.value.payload).toEqual({
      team_id: target,
      action: "release",
    });

    const pause = buildApprovalRequest({
      kind: "website_plan_pause",
      targetId: target,
      reason,
    });
    expect(pause.ok && pause.value.payload).toEqual({ project_id: target });
  });

  it("rejects missing records, short reasons and bad amounts", () => {
    expect(
      buildApprovalRequest({ kind: "refund", targetId: "nope", reason }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "refund",
        targetId: target,
        reason: "Too short",
        amountUsd: "10",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "refund",
        targetId: target,
        reason,
        amountUsd: "0",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "ai_credits",
        targetId: target,
        reason,
        amountCredits: "1.5",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "credits_limit",
        targetId: target,
        teamId: "nope",
        monthlyCredits: "10",
        reason,
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "credits_limit",
        targetId: target,
        teamId: "22222222-2222-4222-8222-222222222222",
        monthlyCredits: "1.5",
        reason,
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "manual_payment",
        targetId: target,
        reason,
        amountUsd: "0",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "credit_adjust",
        targetId: target,
        reason,
        amountUsd: "0",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "grace_extend",
        targetId: target,
        reason,
        days: "0",
      }).ok,
    ).toBe(false);
    expect(
      buildApprovalRequest({
        kind: "billing_hold",
        targetId: target,
        reason,
        holdAction: "release",
        days: "999",
      }).ok,
    ).toBe(false);
  });
});

describe("request approval link", () => {
  it("prefills the target, amount, plan and decision", () => {
    expect(
      requestApprovalHref({
        kind: "refund",
        targetId: target,
        amountUsd: 200.5,
      }),
    ).toBe(
      `/admin/approvals/new?kind=refund&target_id=${target}&amount_usd=200.5`,
    );
    expect(
      requestApprovalHref({ kind: "domain_review", targetId: target, decision: "reject" }),
    ).toBe(
      `/admin/approvals/new?kind=domain_review&target_id=${target}&decision=reject`,
    );
    expect(
      requestApprovalHref({
        kind: "template_publish",
        targetId: target,
        versionId: "33333333-3333-4333-8333-333333333333",
      }),
    ).toBe(
      `/admin/approvals/new?kind=template_publish&target_id=${target}&version_id=33333333-3333-4333-8333-333333333333`,
    );
  });
});
