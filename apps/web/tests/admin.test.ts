import { describe, expect, it } from "vitest";
import {
  forbiddenTables,
  isForbiddenTable,
  staffActionIds,
  staffCan,
  staffMatrix,
} from "@get-on/permissions";
import { adminSiteStatus } from "@/lib/admin/site-status";

describe("staff permissions", () => {
  it("gives a super admin every staff permission", () => {
    for (const action of staffActionIds) {
      expect(staffCan("super_admin", action), action).toBe(true);
    }
  });

  it("keeps money, access and staff changes away from customer success", () => {
    expect(staffCan("customer_success", "account.view")).toBe(true);
    expect(staffCan("customer_success", "billing.payment_status")).toBe(true);
    expect(staffCan("customer_success", "billing.refund.request")).toBe(true);
    expect(staffCan("customer_success", "billing.refund.approve")).toBe(false);
    expect(staffCan("customer_success", "billing.refund.direct")).toBe(false);
    expect(staffCan("customer_success", "staff.manage")).toBe(false);
    expect(staffCan("customer_success", "marketing.campaign.send")).toBe(false);
    expect(staffCan("customer_success", "finance.close")).toBe(false);
  });

  it("never lets staff into customer content", () => {
    for (const table of ["pages", "publishes", "contact_messages", "ai_payloads", "backups"]) {
      expect(isForbiddenTable(table), table).toBe(true);
    }
    expect(forbiddenTables).not.toContain("teams");
    expect(staffMatrix["account.view"].customer_success).toBe(true);
  });
});

describe("admin site status", () => {
  it("puts suspension before review and live", () => {
    expect(
      adminSiteStatus({
        status: "published",
        reviewState: "pending",
        suspendedAt: "2026-10-22T00:00:00.000Z",
      }),
    ).toBe("Suspended");
  });

  it("puts review before live", () => {
    expect(
      adminSiteStatus({ status: "published", reviewState: "pending", suspendedAt: null }),
    ).toBe("Under review");
  });

  it("reports unpublished sites plainly", () => {
    expect(
      adminSiteStatus({ status: "draft", reviewState: "none", suspendedAt: null }),
    ).toBe("Not published");
    expect(
      adminSiteStatus({ status: "published", reviewState: "none", suspendedAt: null }),
    ).toBe("Live");
  });
});
