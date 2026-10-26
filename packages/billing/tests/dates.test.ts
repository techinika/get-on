import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  lastIncludedDay,
  termEnd,
  termStartForRenewal,
} from "../src/dates";

describe("addMonthsClamped", () => {
  it("keeps the day when the month is long enough", () => {
    expect(addMonthsClamped(new Date("2026-01-12T00:00:00Z"), 12).toISOString()).toBe(
      "2027-01-12T00:00:00.000Z",
    );
  });

  it("clamps 31 January to the end of February", () => {
    expect(addMonthsClamped(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("clamps to 29 February in a leap year", () => {
    expect(addMonthsClamped(new Date("2028-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2028-02-29T00:00:00.000Z",
    );
  });

  it("handles a year boundary", () => {
    expect(addMonthsClamped(new Date("2026-12-15T00:00:00Z"), 6).toISOString()).toBe(
      "2027-06-15T00:00:00.000Z",
    );
  });
});

describe("term dates", () => {
  it("ends a 12-month term on the same day next year", () => {
    expect(termEnd(new Date("2026-10-26T10:00:00Z"), 12).toISOString()).toBe(
      "2027-10-26T10:00:00.000Z",
    );
  });

  it("shows the last included day", () => {
    expect(lastIncludedDay(new Date("2027-10-26T10:00:00Z")).toISOString()).toBe(
      "2027-10-25T10:00:00.000Z",
    );
  });

  it("stacks a renewal on active paid time", () => {
    const start = termStartForRenewal(
      new Date("2027-10-26T00:00:00Z"),
      new Date("2027-06-01T00:00:00Z"),
    );
    expect(start.toISOString()).toBe("2027-10-26T00:00:00.000Z");
  });

  it("starts a renewal now when paid time has already ended", () => {
    const start = termStartForRenewal(
      new Date("2027-10-26T00:00:00Z"),
      new Date("2028-02-01T00:00:00Z"),
    );
    expect(start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
  });

  it("starts the first term on the payment date", () => {
    const start = termStartForRenewal(
      null,
      new Date("2026-10-26T00:00:00Z"),
      new Date("2026-10-25T15:30:00Z"),
    );
    expect(start.toISOString()).toBe("2026-10-25T15:30:00.000Z");
  });

  it("counts whole days", () => {
    expect(daysBetween(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-26T00:00:00Z"))).toBe(25);
    expect(addDays(new Date("2026-10-01T00:00:00Z"), 2).toISOString()).toBe(
      "2026-10-03T00:00:00.000Z",
    );
  });
});
