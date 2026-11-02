import { describe, expect, it } from "vitest";
import { checkPasswordPolicy, passwordErrorsFromMessage, passwordScore } from "@/lib/security/passwords";

describe("password policy", () => {
  it("accepts a long, unique passphrase", () => {
    const result = checkPasswordPolicy("Quiet-River-Paper-Lamp9", { email: "amina@example.com", name: "Amina" });
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
    expect(passwordScore("Quiet-River-Paper-Lamp9")).toBeGreaterThanOrEqual(2);
  });

  it("honours a configured minimum length", () => {
    expect(checkPasswordPolicy("twelve-chars", { minLength: 20 }).errors).toContain("TOO_SHORT");
  });

  it("requires the same four character groups as Supabase", () => {
    expect(checkPasswordPolicy("lowercase1!").errors).toEqual(["NEEDS_UPPER"]);
    expect(checkPasswordPolicy("UPPERCASE1!").errors).toEqual(["NEEDS_LOWER"]);
    expect(checkPasswordPolicy("NoNumber!!").errors).toEqual(["NEEDS_NUMBER"]);
    expect(checkPasswordPolicy("NoSymbol123").errors).toEqual(["NEEDS_SYMBOL"]);
  });

  it("reads Supabase password messages", () => {
    expect(
      passwordErrorsFromMessage(
        "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};'\":|<>?,./`~",
      ),
    ).toEqual(["NEEDS_LOWER", "NEEDS_UPPER", "NEEDS_NUMBER", "NEEDS_SYMBOL"]);
    expect(passwordErrorsFromMessage("Password should be at least 12 characters.")).toEqual(["TOO_SHORT"]);
    expect(passwordErrorsFromMessage("Password is too weak")).toEqual(["COMMON"]);
    expect(passwordErrorsFromMessage("The email address is already registered")).toEqual([]);
  });
});
