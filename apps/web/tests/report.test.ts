import { describe, expect, it } from "vitest";
import { normalizeSiteName, reportSchema } from "@/lib/report";

describe("report a website", () => {
  it("accepts a name, a Get-On address or a full URL", () => {
    expect(normalizeSiteName("rosebakery")).toBe("rosebakery");
    expect(normalizeSiteName("RoseBakery.get-on.tech")).toBe("rosebakery");
    expect(normalizeSiteName("https://rosebakery.get-on.tech/menu?x=1")).toBe("rosebakery");
    expect(normalizeSiteName("http://rosebakery.get-on.tech:443/")).toBe("rosebakery");
  });

  it("rejects addresses that are not on Get-On", () => {
    expect(normalizeSiteName("example.com")).toBeNull();
    expect(normalizeSiteName("rosebakery.example.com")).toBeNull();
    expect(normalizeSiteName("-bad")).toBeNull();
    expect(normalizeSiteName("")).toBeNull();
  });

  it("requires a reason and a sensible email", () => {
    const base = { site: "rosebakery", details: "", email: "" };
    expect(reportSchema.safeParse({ ...base, reason: "scam" }).success).toBe(true);
    expect(reportSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...base, reason: "scam", email: "nope" }).success).toBe(false);
    expect(
      reportSchema.safeParse({ ...base, reason: "scam", details: "x".repeat(1001) }).success,
    ).toBe(false);
  });
});
