import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = process.cwd();

function read(path: string) {
  return readFileSync(resolve(WEB, path), "utf8");
}

describe("security: email verification (Problem A)", () => {
  it("(4/5) the verify-email page exists and requires a typed code", () => {
    const src = read("app/verify-email/page.tsx");
    expect(src).toMatch(/CodeStep/);
    expect(src).toMatch(/signup_verify/);
  });

  it("(1/4) no verification links exist: the endpoint only accepts POST codes", () => {
    const route = read("app/api/auth/verify-email/route.ts");
    expect(route).not.toMatch(/confirmation_url|token_hash.*GET/i);
    expect(route).toMatch(/export async function POST/);
    expect(route).not.toMatch(/export async function GET/);
  });

  it("(8) the page does not verify on render", () => {
    const page = read("app/verify-email/page.tsx");
    expect(page).not.toMatch(/verifyOtp|emailOtpProvider\.verify/);
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

  it("(2) codes are bound, single use and hashed", () => {
    const src = read("lib/auth/second-factor.ts");
    expect(src).toMatch(/code_hash/);
    expect(src).toMatch(/consumed_at/);
    expect(src).toMatch(/browser_binding_hash/);
    expect(src).not.toMatch(/insert\(\{[^}]*\bcode:/);
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
