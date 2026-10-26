import { describe, expect, it } from "vitest";
import {
  activeTermAt,
  coverageSummary,
  nextTermStart,
  termsOverlap,
  uncoveredDays,
} from "../src/timeline";
import type { SubscriptionTerm } from "../src/types";

const term = (
  id: string,
  planId: "free" | "basic" | "pro" | "enterprise",
  startsAt: string,
  endsAt: string,
  status: SubscriptionTerm["status"] = "active",
): SubscriptionTerm => ({
  id,
  teamId: "team-1",
  planId,
  startsAt,
  endsAt,
  status,
  invoiceId: null,
});

describe("coverage", () => {
  it("finds the active term", () => {
    const terms = [
      term("a", "basic", "2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z", "ended"),
      term("b", "pro", "2026-07-01T00:00:00Z", "2027-07-01T00:00:00Z"),
    ];
    expect(activeTermAt(terms, new Date("2026-10-26T00:00:00Z"))?.id).toBe("b");
  });

  it("treats the end date as exclusive", () => {
    const terms = [term("a", "basic", "2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z")];
    expect(activeTermAt(terms, new Date("2026-07-01T00:00:00Z"))).toBeNull();
  });

  it("reports a gap between paid terms", () => {
    const terms = [
      term("a", "basic", "2026-01-01T00:00:00Z", "2026-04-01T00:00:00Z", "ended"),
      term("b", "basic", "2026-06-01T00:00:00Z", "2026-09-01T00:00:00Z", "ended"),
    ];
    const summary = coverageSummary(terms, new Date("2026-10-26T00:00:00Z"));
    expect(summary.gaps[0]).toEqual({
      startsAt: "2026-04-01T00:00:00.000Z",
      endsAt: "2026-06-01T00:00:00.000Z",
    });
    expect(summary.gaps.at(-1)?.endsAt).toBe("2026-10-26T00:00:00.000Z");
  });

  it("starts a renewal at the end of the last paid term", () => {
    const terms = [term("a", "pro", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z")];
    expect(
      nextTermStart(terms, new Date("2026-10-26T00:00:00Z")).toISOString(),
    ).toBe("2027-01-01T00:00:00.000Z");
  });

  it("counts uncovered days after coverage ends", () => {
    const terms = [term("a", "basic", "2026-01-01T00:00:00Z", "2026-10-01T00:00:00Z", "ended")];
    expect(uncoveredDays(terms, new Date("2026-10-26T00:00:00Z"))).toBe(25);
    expect(uncoveredDays(terms, new Date("2026-09-01T00:00:00Z"))).toBe(0);
  });

  it("detects overlapping terms", () => {
    expect(
      termsOverlap(
        term("a", "basic", "2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z"),
        term("b", "pro", "2026-06-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      ),
    ).toBe(true);
    expect(
      termsOverlap(
        term("a", "basic", "2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z"),
        term("b", "pro", "2026-07-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      ),
    ).toBe(false);
  });
});
