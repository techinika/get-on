import { describe, expect, it } from "vitest";
import { can, matrix } from "@get-on/permissions";
import { canActOn } from "@/lib/permissions";
import { activityEvent } from "@get-on/activity";
import { hashReferralValue, normalizeReferralCode } from "@/lib/referrals";

describe("permission matrix", () => {
  it("gives the owner everything except leaving their own team", () => {
    for (const action of Object.keys(matrix)) {
      expect(can("owner", action as keyof typeof matrix), action).toBe(action !== "team.leave");
    }
  });

  it("keeps billing and ownership away from admins", () => {
    expect(can("admin", "site.create")).toBe(true);
    expect(can("admin", "site.delete")).toBe(true);
    expect(can("admin", "team.rename")).toBe(true);
    expect(can("admin", "team.transfer")).toBe(false);
    expect(can("admin", "plan.manage")).toBe(false);
  });

  it("keeps people management away from editors and viewers", () => {
    expect(can("editor", "page.edit")).toBe(true);
    expect(can("editor", "page.publish")).toBe(true);
    expect(can("editor", "team.invite.member")).toBe(false);
    expect(can("viewer", "ai.use")).toBe(false);
    expect(can("viewer", "site.view")).toBe(true);
  });

  it("separates admin and member targets", () => {
    expect(canActOn("admin", "editor", "team.remove.member")).toBe(true);
    expect(canActOn("admin", "admin", "team.remove.member")).toBe(false);
    expect(canActOn("admin", "admin", "team.remove.admin")).toBe(false);
    expect(canActOn("owner", "admin", "team.remove.admin")).toBe(true);
  });
});

describe("activity catalog", () => {
  it("knows the team platform events", () => {
    for (const event of [
      "website_created",
      "website_deleted",
      "website_restored",
      "website_purged",
      "invite_expired",
      "referral_reward_claimed",
      "page_created",
      "page_deleted",
    ]) {
      expect(activityEvent(event), event).toBeTruthy();
    }
  });

  it("keeps older dotted event names readable", () => {
    for (const event of ["page.edited", "settings.business_updated", "redirect.added"]) {
      expect(activityEvent(event), event).toBeTruthy();
    }
  });
});

describe("referral codes", () => {
  it("normalises user input", () => {
    expect(normalizeReferralCode(" ab12cd34 ")).toBe("AB12CD34");
    expect(normalizeReferralCode(null)).toBe("");
  });

  it("hashes values without keeping the original", () => {
    const hash = hashReferralValue("Person@Example.com");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashReferralValue(" person@example.com "));
    expect(hash).not.toContain("person");
  });
});
