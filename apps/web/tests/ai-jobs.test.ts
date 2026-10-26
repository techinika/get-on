import { describe, expect, it } from "vitest";
import { grantMonthlyCredits, monthlyExpiry, monthlyPeriod } from "@/lib/ai/jobs";

describe("AI credit jobs", () => {
  it("builds the UTC month key", () => {
    expect(monthlyPeriod(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10");
    expect(monthlyPeriod(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("expires monthly credits at the end of the following month", () => {
    expect(monthlyExpiry(new Date("2026-10-25T00:00:00Z"))).toBe(
      "2026-11-30T23:59:59.999Z",
    );
    expect(monthlyExpiry(new Date("2026-12-15T00:00:00Z"))).toBe(
      "2027-01-31T23:59:59.999Z",
    );
  });

  it("grants credits from the effective plan, not the cached plan", async () => {
    const grants: Array<{ team: string; amount: number }> = [];
    const admin = {
      from(table: string) {
        return {
          select: async () => ({
            data:
              table === "plans"
                ? [{ id: "pro", ai_monthly_credits: 400 }]
                : [{ id: "team-pro" }, { id: "team-free" }],
            error: null,
          }),
        };
      },
      async rpc(name: string, args: { p_team?: string; p_amount?: number }) {
        if (name === "billing_resolve_team") {
          return {
            data: { plan_id: args.p_team === "team-pro" ? "pro" : "free" },
            error: null,
          };
        }
        if (name === "grant_credits") {
          grants.push({ team: String(args.p_team), amount: Number(args.p_amount) });
          return { data: null, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };

    const result = await grantMonthlyCredits(
      admin as never,
      new Date("2026-10-25T00:00:00Z"),
    );

    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(grants).toEqual([{ team: "team-pro", amount: 400 }]);
  });
});
