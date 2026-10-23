import { describe, expect, it } from "vitest";
import { createTimeToken, hashIp, verifyTimeToken } from "@/lib/spam";

describe("spam protection", () => {
  it("accepts a token that was issued a moment ago", () => {
    const now = Date.now();
    const token = createTimeToken(now);
    expect(verifyTimeToken(token, now + 5000)).toBe("ok");
  });

  it("rejects a form that was sent too fast", () => {
    const now = Date.now();
    const token = createTimeToken(now);
    expect(verifyTimeToken(token, now + 500)).toBe("too_fast");
  });

  it("rejects a token that is too old", () => {
    const now = Date.now();
    const token = createTimeToken(now);
    expect(verifyTimeToken(token, now + 3 * 60 * 60 * 1000)).toBe("expired");
  });

  it("rejects a missing or tampered token", () => {
    const now = Date.now();
    expect(verifyTimeToken(null, now)).toBe("invalid");
    expect(verifyTimeToken("", now)).toBe("invalid");
    expect(verifyTimeToken(`${Math.floor(now / 1000)}.deadbeef`, now)).toBe("invalid");
  });

  it("hashes the same address to the same value", () => {
    const first = hashIp("203.0.113.9");
    const second = hashIp("203.0.113.9");
    expect(first).toBe(second);
    expect(first).not.toContain("203.0.113.9");
  });

  it("hashes different addresses to different values", () => {
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });
});
