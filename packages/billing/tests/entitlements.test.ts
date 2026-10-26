import { describe, expect, it } from "vitest";
import {
  checkLimit,
  hasRoom,
  resolveAccess,
} from "../src/entitlements";
import type { AccessGrant, SubscriptionTerm } from "../src/types";

const term = (
  id: string,
  planId: "free" | "basic" | "pro" | "enterprise",
  startsAt: string,
  endsAt: string,
): SubscriptionTerm => ({
  id,
  teamId: "team-1",
  planId,
  startsAt,
  endsAt,
  status: "active",
  invoiceId: null,
});

const grant = (
  id: string,
  planId: "free" | "basic" | "pro" | "enterprise",
  startsAt: string,
  endsAt: string | null,
): AccessGrant => ({
  id,
  teamId: "team-1",
  planId,
  startsAt,
  endsAt,
  revokedAt: null,
});

describe("resolveAccess", () => {
  const now = new Date("2026-10-26T00:00:00Z");

  it("uses an active paid term first", () => {
    const access = resolveAccess({
      terms: [term("a", "pro", "2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z")],
      grants: [grant("g", "enterprise", "2026-01-01T00:00:00Z", null)],
      now,
      graceDays: 7,
    });
    expect(access.planId).toBe("pro");
    expect(access.source).toBe("paid");
    expect(access.status).toBe("active");
  });

  it("uses an active grant when there is no paid term", () => {
    const access = resolveAccess({
      terms: [],
      grants: [grant("g", "basic", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")],
      now,
      graceDays: 7,
    });
    expect(access.planId).toBe("basic");
    expect(access.source).toBe("grant");
    expect(access.status).toBe("active");
  });

  it("chooses the higher plan when grants overlap", () => {
    const access = resolveAccess({
      terms: [],
      grants: [
        grant("a", "basic", "2026-10-01T00:00:00Z", null),
        grant("b", "pro", "2026-10-01T00:00:00Z", null),
      ],
      now,
      graceDays: 7,
    });
    expect(access.planId).toBe("pro");
  });

  it("keeps the paid plan during grace", () => {
    const access = resolveAccess({
      terms: [term("a", "pro", "2026-01-01T00:00:00Z", "2026-10-20T00:00:00Z")],
      grants: [],
      now,
      graceDays: 10,
    });
    expect(access.planId).toBe("pro");
    expect(access.source).toBe("grace");
    expect(access.status).toBe("grace");
    expect(access.graceEndsAt).toBe("2026-10-30T00:00:00.000Z");
  });

  it("falls back to free after grace", () => {
    const access = resolveAccess({
      terms: [term("a", "pro", "2026-01-01T00:00:00Z", "2026-10-20T00:00:00Z")],
      grants: [],
      now,
      graceDays: 3,
    });
    expect(access.planId).toBe("free");
    expect(access.source).toBe("lapsed");
    expect(access.status).toBe("lapsed");
  });

  it("returns free for a new team", () => {
    const access = resolveAccess({ terms: [], grants: [], now, graceDays: 7 });
    expect(access.planId).toBe("free");
    expect(access.source).toBe("free");
    expect(access.status).toBe("free");
  });

  it("ignores a revoked grant", () => {
    const access = resolveAccess({
      terms: [],
      grants: [{ ...grant("g", "pro", "2026-01-01T00:00:00Z", null), revokedAt: "2026-10-01T00:00:00Z" }],
      now,
      graceDays: 7,
    });
    expect(access.planId).toBe("free");
  });
});

describe("limits", () => {
  it("treats null as unlimited", () => {
    expect(checkLimit(null, 10_000)).toEqual({
      allowed: true,
      unlimited: true,
      remaining: null,
      limit: null,
    });
  });

  it("treats zero as a real limit", () => {
    expect(checkLimit(0, 0).allowed).toBe(false);
    expect(checkLimit(0, 0).remaining).toBe(0);
  });

  it("allows up to but not beyond the limit", () => {
    expect(hasRoom(3, 2)).toBe(true);
    expect(hasRoom(3, 3)).toBe(false);
    expect(hasRoom(3, 4)).toBe(false);
  });
});
