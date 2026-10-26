import { describe, expect, it } from "vitest";
import {
  friendlyTransferError,
  hashTransferToken,
  newTransferToken,
  normalizeTransferEmail,
  transferLink,
} from "@/lib/team/transfers";

describe("website transfers", () => {
  it("stores only a stable hash of the token", () => {
    const { token, hash } = newTransferToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashTransferToken(token)).toBe(hash);
    expect(hashTransferToken(`${token}x`)).not.toBe(hash);
  });

  it("builds a link on the transfer route", () => {
    expect(transferLink("abc")).toContain("/transfer/abc");
  });

  it("compares emails without case or surrounding spaces", () => {
    expect(normalizeTransferEmail("  Person@Example.COM ")).toBe("person@example.com");
  });

  it("explains plan and link problems in plain language", () => {
    expect(friendlyTransferError("TRANSFER_SITE_LIMIT")).toContain("no room");
    expect(friendlyTransferError("TRANSFER_EMAIL_MISMATCH")).toContain("different email");
    expect(friendlyTransferError("TRANSFER_EXPIRED")).toContain("ended");
    expect(friendlyTransferError("SOMETHING_ELSE")).toBe("That did not work. Please try again.");
  });
});
