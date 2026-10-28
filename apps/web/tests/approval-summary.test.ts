import { describe, expect, it } from "vitest";
import {
  approvalAmount,
  approvalHasExecutor,
  approvalKindLabel,
  approvalPayloadLines,
  approvalSummary,
  approvalTarget,
  approvalThreshold,
} from "@/lib/admin/approval-summary";

describe("approval summaries", () => {
  it("uses plain labels and friendly targets", () => {
    expect(approvalKindLabel("refund")).toBe("Refund a payment");
    expect(approvalKindLabel("something_new")).toBe("Staff action");
    expect(
      approvalTarget({
        kind: "refund",
        target_type: "team",
        target_id: "12345678-abcd-4000-8000-123456789012",
        payload: { team_name: "Acme" },
      }),
    ).toBe("Acme");
  });

  it("summarises a refund and names the payment", () => {
    const request = {
      kind: "refund",
      target_type: "payment",
      target_id: "12345678-abcd-4000-8000-123456789012",
      payload: { amount_cents: 24000, team_name: "Acme" },
    };
    expect(approvalAmount(request)).toBe("$240.00");
    expect(approvalSummary(request)).toBe("Refund $240.00 to Acme.");
  });

  it("shows credits and plan names without raw JSON", () => {
    const credits = {
      kind: "ai_credits",
      target_type: "team",
      target_id: "12345678-abcd-4000-8000-123456789012",
      payload: { credits: 1500, team_name: "Acme" },
    };
    expect(approvalAmount(credits)).toBe("1,500 AI credits");
    expect(approvalSummary(credits)).toBe("Add 1,500 AI credits to Acme.");

    const lines = approvalPayloadLines({
      payload: {
        amount_cents: 24000,
        team_name: "Acme",
        member_id: "12345678-abcd-4000-8000-123456789012",
        expires_at: "2026-11-10T10:00:00.000Z",
        nested: { secret: "not shown" },
      },
    });
    expect(lines).toContainEqual({ label: "Amount", value: "$240.00" });
    expect(lines).toContainEqual({ label: "Team", value: "Acme" });
    expect(lines).toContainEqual({ label: "Member reference", value: "12345678…" });
    expect(lines.some((line) => line.value.includes("secret"))).toBe(false);
    expect(lines.some((line) => line.label === "nested")).toBe(false);
  });

  it("explains dual control and single-operator mode", () => {
    expect(
      approvalThreshold({
        requires_second: true,
        threshold_usd: 200,
        threshold_credits: null,
      }),
    ).toBe("A second Super admin is needed above $200.00.");
    expect(
      approvalThreshold({
        requires_second: true,
        threshold_usd: "200.50",
        threshold_credits: null,
      }),
    ).toBe("A second Super admin is needed above $200.50.");
    expect(
      approvalThreshold(
        {
          requires_second: true,
          threshold_credits: 1000,
          threshold_usd: null,
        },
      ),
    ).toBe("A second Super admin is needed above 1,000 AI credits.");
    expect(
      approvalThreshold(
        { requires_second: true, threshold_usd: null, threshold_credits: null },
        { singleOperator: true },
      ),
    ).toContain("no second Super admin");
  });

  it("only reports executors that exist", () => {
    expect(approvalHasExecutor("refund")).toBe(true);
    expect(approvalHasExecutor("ai_credits")).toBe(true);
    expect(approvalHasExecutor("manual_payment")).toBe(false);
  });
});
