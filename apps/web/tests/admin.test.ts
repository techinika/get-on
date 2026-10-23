import { afterEach, describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "@/lib/admin";
import { adminSiteStatus } from "@/lib/admin-data";

const previous = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (previous === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = previous;
});

describe("admin access", () => {
  it("reads a comma-separated list and ignores blanks", () => {
    process.env.ADMIN_EMAILS = " A@Example.com, ,b@example.com ";
    expect(adminEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("matches email case-insensitively", () => {
    process.env.ADMIN_EMAILS = "a@example.com";
    expect(isAdminEmail(" A@EXAMPLE.COM ")).toBe(true);
    expect(isAdminEmail("someone@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it("allows nobody when the list is empty", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("owner@example.com")).toBe(false);
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
