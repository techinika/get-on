import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = process.cwd();

describe("security: verification (Problem A) — failing until fixed", () => {
  it("(4/5) verify-email page exists for typed codes", () => {
    expect(existsSync(resolve(WEB, "app/verify-email/page.tsx"))).toBe(true);
  });

  it("(4/5) middleware checks email verification, not just user presence", () => {
    const src = readFileSync(resolve(WEB, "proxy.ts"), "utf8");
    expect(src).toMatch(/email_confirmed_at|verified/i);
  });

  it("(1/8) verify-email page uses a typed code input, not a link", () => {
    const src = readFileSync(resolve(WEB, "app/verify-email/page.tsx"), "utf8");
    expect(src).toMatch(/inputmode=["']numeric["']|OtpInput|one-time-code/i);
  });

  it("(5) a requireVerifiedSession helper exists", () => {
    expect(
      existsSync(resolve(WEB, "lib/auth/require-verified-session.ts")) ||
        existsSync(resolve(WEB, "lib/security/require-verified-session.ts")),
    ).toBe(true);
  });
});
