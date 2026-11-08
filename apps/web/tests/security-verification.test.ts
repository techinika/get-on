import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = process.cwd();

function read(path: string) {
  return readFileSync(resolve(WEB, path), "utf8");
}

describe("security: email verification (Problem A)", () => {
  it("(4/5) the verify-email page explains the emailed link and has no code box", () => {
    const src = read("app/verify-email/page.tsx");
    expect(src).toMatch(/readPendingSignup/);
    expect(src).toMatch(/confirmation link/i);
    expect(src).not.toMatch(/CodeStep|OtpInput|api\/auth\/verify-email/);
  });

  it("(1/4) the email link verifies through the token hash route", () => {
    const route = read("app/auth/confirm/route.ts");
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/token_hash/);
    expect(route).toMatch(/verifyOtp/);
    expect(route).toMatch(/type: "signup"/);
  });

  it("(8) the page does not verify on render", () => {
    const page = read("app/verify-email/page.tsx");
    expect(page).not.toMatch(/verifyOtp|exchangeCodeForSession/);
  });

  it("(4/5) the old typed-code endpoint is gone", () => {
    expect(existsSync(resolve(WEB, "app/api/auth/verify-email/route.ts"))).toBe(false);
  });

  it("(5) the middleware checks a completed second step, not just a user", () => {
    const src = read("proxy.ts");
    expect(src).toMatch(/isSessionUsable|session_verified/);
  });

  it("(5) server helpers expose a verified-session guard", () => {
    expect(existsSync(resolve(WEB, "lib/auth/require-verified-session.ts"))).toBe(true);
  });

  it("(3/4) the legacy signup route cannot create an account", () => {
    const route = read("app/auth/sign-up/route.ts");
    expect(route).not.toMatch(/auth\.signUp|signUp\(/);
    expect(route).toMatch(/redirect/);
  });

  it("(2) sign-in uses Supabase MFA, not local email codes", () => {
    expect(existsSync(resolve(WEB, "app/api/auth/otp/verify/route.ts"))).toBe(false);
    expect(existsSync(resolve(WEB, "lib/auth/second-factor.ts"))).toBe(false);
    const login = read("app/api/auth/login/route.ts");
    expect(login).toMatch(/mfa\.listFactors/);
    expect(login).toMatch(/\/mfa/);
    const form = read("components/auth/mfa-challenge-form.tsx");
    expect(form).toMatch(/auth\.mfa\.verify/);
  });
});

describe("security: registration (Problem B)", () => {
  it("uses the canonical email for the uniqueness check", () => {
    const src = read("lib/auth/register.ts");
    expect(src).toMatch(/canonicalEmail/);
    expect(src).toMatch(/email_canonical/);
  });

  it("tells the user when the email is already registered", () => {
    const src = read("app/signup/signup-form.tsx");
    expect(src).toMatch(/AUTH_EMAIL_EXISTS/);
  });
});
