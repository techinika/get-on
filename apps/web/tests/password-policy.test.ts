import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, passwordScore } from "@/lib/security/passwords";

describe("password policy", () => {
  it("accepts a long, unique passphrase", () => {
    const result = checkPasswordPolicy("quiet-river-paper-lamp", { email: "amina@example.com", name: "Amina" });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects short passwords", () => {
    expect(checkPasswordPolicy("short1").errors).toContain("TOO_SHORT");
  });

  it("rejects the very long ones", () => {
    expect(checkPasswordPolicy("a".repeat(129)).errors).toContain("TOO_LONG");
  });

  it("rejects common passwords", () => {
    expect(checkPasswordPolicy("password123").errors).toContain("COMMON");
    expect(checkPasswordPolicy("qwertyuiop").errors).toContain("COMMON");
  });

  it("rejects the email local part and the display name", () => {
    expect(checkPasswordPolicy("amina-is-my-name", { email: "amina@example.com" }).errors).toContain(
      "CONTAINS_PERSONAL",
    );
    expect(checkPasswordPolicy("Jonathan-2024-pass", { name: "Jonathan" }).errors).toContain("CONTAINS_PERSONAL");
  });

  it("rejects repeated characters", () => {
    expect(checkPasswordPolicy("aaaaaaaaaaaa").errors).toContain("REPEATED");
  });

  it("rejects sequences", () => {
    expect(checkPasswordPolicy("abcd-efgh-ijkl").errors).toContain("SEQUENTIAL");
    expect(checkPasswordPolicy("9876-5432-1000").errors).toContain("SEQUENTIAL");
  });

  it("reports a strength score between 0 and 4", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("password")).toBe(0);
    expect(passwordScore("quiet-river-paper-lamp")).toBeGreaterThanOrEqual(2);
  });

  it("honours a configured minimum length", () => {
    expect(checkPasswordPolicy("twelve-chars", { minLength: 20 }).errors).toContain("TOO_SHORT");
  });
});
