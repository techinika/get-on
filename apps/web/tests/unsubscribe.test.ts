import { describe, expect, it } from "vitest";
import { isUnsubscribeToken } from "@/lib/email/unsubscribe";

describe("unsubscribe token", () => {
  it("accepts a 24-byte hex token", () => {
    expect(isUnsubscribeToken("a".repeat(48))).toBe(true);
    expect(isUnsubscribeToken("0123456789abcdef".repeat(3))).toBe(true);
  });

  it("rejects missing, short, long and non-hex values", () => {
    expect(isUnsubscribeToken(null)).toBe(false);
    expect(isUnsubscribeToken(undefined)).toBe(false);
    expect(isUnsubscribeToken("")).toBe(false);
    expect(isUnsubscribeToken("a".repeat(47))).toBe(false);
    expect(isUnsubscribeToken("a".repeat(49))).toBe(false);
    expect(isUnsubscribeToken("g".repeat(48))).toBe(false);
    expect(isUnsubscribeToken("../../etc/passwd")).toBe(false);
  });
});
