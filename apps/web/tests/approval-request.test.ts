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
    expect(kinds).not.toContain("manual_payment");
    expect(kinds).not.toContain("account_delete");
    expect(approvalRequestKind("refund")?.targetType).toBe("payment");
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
        kind: "manual_payment",
        targetId: target,
        reason,
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
  });
});
