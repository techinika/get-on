import { describe, expect, it } from "vitest";
import { PLAN_BY_ID, PLAN_DEFINITIONS } from "@/lib/plans";
import { toFriendlyAuthError } from "@/lib/auth-errors";

describe("plan definitions", () => {
  it("keeps all expected plans", () => {
    expect(PLAN_DEFINITIONS.map((plan) => plan.id)).toEqual([
      "free",
      "basic",
      "pro",
      "enterprise",
    ]);
    expect(PLAN_BY_ID.free.maxWebsites).toBe(1);
    expect(PLAN_BY_ID.enterprise.maxWebsites).toBeNull();
  });
});

describe("friendly auth messages", () => {
  it("maps known Supabase auth errors", () => {
    expect(toFriendlyAuthError("Password should be at least 8 characters")).toBe(
      "That password is too short. Use at least 8 characters.",
    );
  });
});
