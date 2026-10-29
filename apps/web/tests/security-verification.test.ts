import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const WEB = resolve(ROOT, "apps/web");

describe("security: verification (Problem A) — failing until fixed", () => {
  it("(4/5) verify-email page exists for typed codes", () => {
    expect(existsSync(resolve(WEB, "app/verify-email/page.tsx"))).toBe(true);
  });

  it("(4/5) middleware checks email verification, not just user presence", () => {
    const src = readFileSync(resolve(WEB, "proxy.ts"), "utf8");
    expect(src).toMatch(/email_verified|verified_at|session_verified/i);
  });

  it("(1/8) confirmation callback is not a single-use GET that scanners can consume", () => {
    const src = readFileSync(resolve(WEB, "app/auth/callback/route.ts"), "utf8");
    // After the fix, email confirmation no longer happens via a GET code exchange.
    expect(src).not.toMatch(/exchangeCodeForSession/);
  });

  it("(5) a requireVerifiedSession helper exists", () => {
    expect(
      existsSync(resolve(WEB, "lib/auth/require-verified-session.ts")) ||
        existsSync(resolve(WEB, "lib/security/require-verified-session.ts")),
    ).toBe(true);
  });
});
