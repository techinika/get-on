import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = process.cwd();

function read(path: string) {
  return readFileSync(resolve(WEB, path), "utf8");
}

describe("security: account recovery", () => {
  it("(1) reset links are single-use database tokens, not signed URLs", () => {
    const src = read("lib/auth/recovery.ts");
    expect(src).toMatch(/hashToken\(token\)/);
    expect(src).toMatch(/used_at/);
    expect(src).toMatch(/purpose: AuthTokenPurpose/);
  });

  it("(2) opening the reset page does not change anything", () => {
    const page = read("app/reset-password/page.tsx");
    expect(page).toMatch(/findAuthToken/);
    expect(page).not.toMatch(/consumeAuthToken|setUserPassword|revokeAllSessions/);
    expect(page).toMatch(/robots: \{ index: false/);
  });

  it("(3) the reset POST consumes the token, then signs out every session", () => {
    const route = read("app/api/auth/password/reset/route.ts");
    expect(route).toMatch(/export async function POST/);
    const consume = route.indexOf("consumeAuthToken");
    const revoke = route.indexOf("revokeAllSessions");
    expect(consume).toBeGreaterThan(-1);
    expect(revoke).toBeGreaterThan(consume);
    expect(route).toMatch(/checkPasswordPolicy/);
    expect(route).toMatch(/isPasswordBreached/);
    expect(route).not.toMatch(/export async function GET/);
  });

  it("(4) a reset request answers the same way for unknown addresses", () => {
    const route = read("app/api/auth/password/forgot/route.ts");
    expect(route).toMatch(/\/forgot-password\?sent=1/);
    expect(route).not.toMatch(/error=AUTH_EMAIL_UNKNOWN|not found/i);
    expect(route).toMatch(/passwordResetPerEmail/);
    expect(route).toMatch(/passwordResetPerIp/);
  });

  it("(5) the legacy Supabase reset routes are removed", () => {
    expect(existsSync(resolve(WEB, "app/auth/forgot-password/route.ts"))).toBe(false);
    expect(existsSync(resolve(WEB, "app/auth/reset-password/route.ts"))).toBe(false);
  });

  it("(6) the new-device email carries a working not-me link", () => {
    const complete = read("app/api/auth/mfa/complete/route.ts");
    expect(complete).toMatch(/purpose: "not_me"/);
    expect(complete).toMatch(/secureUrl/);
    const page = read("app/security/not-me/page.tsx");
    expect(page).toMatch(/findAuthToken\(params\.t, "not_me"\)/);
  });

  it("(7) not-me revokes every session and sends a new reset link", () => {
    const route = read("app/api/auth/not-me/route.ts");
    expect(route).toMatch(/findAuthToken\(token, "not_me"\)/);
    expect(route).toMatch(/revokeAllSessions/);
    expect(route).toMatch(/purpose: "password_reset"/);
    expect(route).toMatch(/not_me_reported/);
    expect(route).not.toMatch(/export async function GET/);
  });
});
