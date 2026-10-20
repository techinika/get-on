import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_DEFINITIONS } from "@/lib/plans";

/**
 * The pricing section renders prices/limits from PLAN_DEFINITIONS.
 * These must stay in sync with the `plans` rows seeded in Supabase.
 * Fails when the shared constant and the SQL seed drift apart.
 */

const SEED = readFileSync(
  join(__dirname, "../../../supabase/seed.sql"),
  "utf8",
);

function parseSeedPlans(): Map<string, Record<string, string>> {
  const plans = new Map<string, Record<string, string>>();
  // Rows look like: ('free', 'Free', 0.00, 1, 1, 1, 1, 10, 100, 0, false, true),
  const rowRe =
    /\('([a-z]+)',\s*'([^']+)',\s*([0-9.]+),\s*(\d+|null),\s*(\d+|null),\s*(\d+|null),\s*(\d+|null),\s*(\d+),\s*(\d+),\s*(\d+),\s*(true|false),\s*(true|false)\)/g;
  for (const m of SEED.matchAll(rowRe)) {
    plans.set(m[1]!, {
      name: m[2]!,
      price: m[3]!,
      maxWebsites: m[4]!,
      maxPages: m[5]!,
      maxMembers: m[6]!,
      maxPlugins: m[7]!,
      aiCredits: m[8]!,
      storage: m[9]!,
      emails: m[10]!,
      customDomain: m[11]!,
      watermark: m[12]!,
    });
  }
  return plans;
}

const num = (v: string | null): number | null => (v === "null" ? null : Number(v));
const bool = (v: string): boolean => v === "true";

describe("plan definitions match the database seed", () => {
  const seeded = parseSeedPlans();

  it("parses all four plans from seed.sql", () => {
    expect(seeded.size).toBe(4);
  });

  it.each(PLAN_DEFINITIONS.map((p) => [p.id, p] as const))(
    "%s stays in sync with seed.sql",
    (id, plan) => {
      const row = seeded.get(id);
      expect(row, `plan "${id}" missing from seed.sql`).toBeDefined();
      if (!row) return;

      expect(plan.name).toBe(row.name);
      expect(plan.priceUsdMonthly).toBe(Number(row.price));
      expect(plan.maxWebsites).toBe(num(row.maxWebsites));
      expect(plan.maxPagesPerSite).toBe(num(row.maxPages));
      expect(plan.maxMembers).toBe(num(row.maxMembers));
      expect(plan.maxPlugins).toBe(num(row.maxPlugins));
      expect(plan.aiCreditsMonthly).toBe(Number(row.aiCredits));
      expect(plan.storageMb).toBe(Number(row.storage));
      expect(plan.monthlyEmails).toBe(Number(row.emails));
      expect(plan.customDomainAllowed).toBe(bool(row.customDomain));
      expect(plan.watermarkRequired).toBe(bool(row.watermark));
    },
  );

  it("matches the prices shown in the UI spec", () => {
    const price = (id: string) => PLAN_DEFINITIONS.find((p) => p.id === id)!.priceUsdMonthly;
    expect(price("free")).toBe(0);
    expect(price("basic")).toBe(7.99);
    expect(price("pro")).toBe(13.99);
    expect(price("enterprise")).toBe(59.99);
  });
});
