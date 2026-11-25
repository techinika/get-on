import { describe, expect, it } from "vitest";
import {
  ensureTeamMonthlyCredits,
  grantMonthlyCredits,
  monthlyExpiry,
  monthlyPeriod,
} from "@/lib/ai/jobs";

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

  it("falls back to plan catalog for paid plans and skips lapsed teams", async () => {
    const grants: Array<{ team: string; amount: number }> = [];
    const admin = {
      from(table: string) {
        return {
          select: async () => ({
            data:
              table === "plans"
                ? [{ id: "basic", ai_monthly_credits: 0 }]
                : [{ id: "team-basic" }, { id: "team-lapsed" }],
            error: null,
          }),
        };
      },
      async rpc(name: string, args: { p_team?: string; p_amount?: number }) {
        if (name === "billing_resolve_team") {
          if (args.p_team === "team-lapsed") {
            return { data: { plan_id: "pro", status: "lapsed" }, error: null };
          }
          return { data: { plan_id: "basic", status: "active" }, error: null };
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
    expect(grants).toEqual([{ team: "team-basic", amount: 200 }]);
  });

  it("ensures monthly credits idempotently for a single team", async () => {
    const buckets = new Set<string>();
    const grants: Array<{ source: string; amount: number }> = [];

    const admin = {
      from(table: string) {
        const filters: Record<string, unknown> = {};
        const query = {
          select() {
            return query;
          },
          eq(column: string, value: unknown) {
            filters[column] = value;
            return query;
          },
          limit() {
            return query;
          },
          async maybeSingle() {
            if (table === "credit_buckets") {
              const key = `${filters.team_id}:${filters.source}`;
              return {
                data: buckets.has(key) ? { id: "bucket-1" } : null,
                error: null,
              };
            }
            return {
              data: { id: "pro", ai_monthly_credits: 1000 },
              error: null,
            };
          },
        };
        return query;
      },
      async rpc(
        name: string,
        args: { p_team?: string; p_source?: string; p_amount?: number },
      ) {
        if (name === "grant_credits") {
          buckets.add(`${args.p_team}:${args.p_source}`);
          grants.push({
            source: String(args.p_source),
            amount: Number(args.p_amount),
          });
          return { data: null, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      },
    };

    const now = new Date("2026-10-25T00:00:00Z");
    const first = await ensureTeamMonthlyCredits(admin as never, "team-pro", {
      planId: "pro",
      status: "active",
      now,
    });
    const second = await ensureTeamMonthlyCredits(admin as never, "team-pro", {
      planId: "pro",
      status: "active",
      now,
    });
    const free = await ensureTeamMonthlyCredits(admin as never, "team-free", {
      planId: "free",
      status: "free",
      now,
    });

    expect(first).toEqual({ granted: true, amount: 1000 });
    expect(second).toEqual({ granted: false, amount: 0 });
    expect(free).toEqual({ granted: false, amount: 0 });
    expect(grants).toEqual([{ source: "monthly:2026-10", amount: 1000 }]);
  });
});
