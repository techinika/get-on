import { describe, expect, it } from "vitest";
import {
  challengeHash,
  generateCode,
  hashBrowserBinding,
  hashEmail,
  isCodeShape,
  loadPeppers,
  maskEmail,
  newBindingValue,
  normaliseCode,
  pepperForVersion,
  verifyCodeConstantTime,
} from "@/lib/security/otp";

describe("otp: code generation", () => {
  it("always returns the requested number of digits", () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateCode(6);
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });

  it("keeps leading zeros", () => {
    const codes = Array.from({ length: 3000 }, () => generateCode(6));
    expect(codes.some((code) => code.startsWith("0"))).toBe(true);
  });

  it("is roughly uniform over the digit range", () => {
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 4000; i += 1) {
      const code = generateCode(6);
      counts[Number(code[5])] += 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(250);
      expect(count).toBeLessThan(550);
    }
  });

  it("rejects impossible lengths", () => {
    expect(() => generateCode(3)).toThrow();
    expect(() => generateCode(11)).toThrow();
  });
});

describe("otp: input normalisation", () => {
  it("accepts spaces and dashes", () => {
    expect(normaliseCode("12 34-56")).toBe("123456");
  });

  it("rejects letters", () => {
    expect(normaliseCode("12a456")).toBeNull();
  });

  it("checks the exact shape", () => {
    expect(isCodeShape("123456", 6)).toBe(true);
    expect(isCodeShape("12345", 6)).toBe(false);
    expect(isCodeShape("12345a", 6)).toBe(false);
  });
});

describe("otp: challenge hashes", () => {
  const pepper = "a-test-pepper-that-is-long-enough";

  it("is stable for the same inputs", () => {
    expect(challengeHash("login", "user-1", "challenge-1", "123456", pepper)).toBe(
      challengeHash("login", "user-1", "challenge-1", "123456", pepper),
    );
  });

  it("separates every purpose, subject, challenge and code", () => {
    const base = challengeHash("login", "user-1", "challenge-1", "123456", pepper);
    expect(challengeHash("step_up", "user-1", "challenge-1", "123456", pepper)).not.toBe(base);
    expect(challengeHash("login", "user-2", "challenge-1", "123456", pepper)).not.toBe(base);
    expect(challengeHash("login", "user-1", "challenge-2", "123456", pepper)).not.toBe(base);
    expect(challengeHash("login", "user-1", "challenge-1", "654321", pepper)).not.toBe(base);
    expect(challengeHash("login", "user-1", "challenge-1", "123456", `${pepper}x`)).not.toBe(base);
  });

  it("compares in constant time and rejects tampering", () => {
    const hash = challengeHash("login", "user-1", "challenge-1", "123456", pepper);
    expect(verifyCodeConstantTime(hash, hash)).toBe(true);
    const other = challengeHash("login", "user-1", "challenge-1", "123457", pepper);
    expect(verifyCodeConstantTime(hash, other)).toBe(false);
    expect(verifyCodeConstantTime(hash, "not-hex")).toBe(false);
  });
});

describe("otp: peppers", () => {
  it("returns the current pepper first and the previous one second", () => {
    const peppers = loadPeppers({ OTP_PEPPER: "x".repeat(40), OTP_PEPPER_PREVIOUS: "y".repeat(40), NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(peppers).toHaveLength(2);
    expect(peppers[0].secret).toBe("x".repeat(40));
    expect(peppers[0].version).toBe(1);
    expect(peppers[1].version).toBe(0);
  });

  it("finds a pepper by version", () => {
    const env = { OTP_PEPPER: "x".repeat(40), OTP_PEPPER_PREVIOUS: "y".repeat(40), OTP_PEPPER_VERSION: "3" } as unknown as NodeJS.ProcessEnv;
    expect(pepperForVersion(2, env).secret).toBe("y".repeat(40));
    expect(pepperForVersion(3, env).secret).toBe("x".repeat(40));
    expect(() => pepperForVersion(9, env)).toThrow();
  });
});

describe("otp: helpers", () => {
  it("masks an email address", () => {
    expect(maskEmail("amina@example.com")).toBe("a***@example.com");
    expect(maskEmail("not-an-email")).toBe("your email address");
  });

  it("hashes emails case-insensitively but distinguishes different addresses", () => {
    expect(hashEmail("A@Example.com")).toBe(hashEmail(" a@example.com "));
    expect(hashEmail("a@example.com")).not.toBe(hashEmail("b@example.com"));
  });

  it("produces fresh 32-byte binding values", () => {
    const values = new Set(Array.from({ length: 50 }, () => newBindingValue()));
    expect(values.size).toBe(50);
    for (const value of values) expect(value.length).toBeGreaterThanOrEqual(40);
  });

  it("binds a cookie value with the secret", () => {
    expect(hashBrowserBinding("abc", "secret-one")).not.toBe(hashBrowserBinding("abc", "secret-two"));
  });
});
