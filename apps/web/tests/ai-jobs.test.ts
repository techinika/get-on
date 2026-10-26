import { describe, expect, it } from "vitest";
import { monthlyExpiry, monthlyPeriod } from "@/lib/ai/jobs";

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
});
