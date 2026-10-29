import { describe, expect, it } from "vitest";
import { signToken, verifyToken, tokenSecret } from "@/lib/security/tokens";
import { safeNextPath, uaFamily } from "@/lib/security/request";
import { sessionIdFromAccessToken } from "@/lib/auth/session-security";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("signed tokens", () => {
  it("round-trips a payload", () => {
    const { value } = signToken({ challengeId: "abc", purpose: "login" }, 60, "test-secret");
    const parsed = verifyToken(value, "test-secret");
    expect(parsed?.challengeId).toBe("abc");
    expect(parsed?.purpose).toBe("login");
  });

  it("rejects a tampered payload", () => {
    const { value } = signToken({ challengeId: "abc" }, 60, "test-secret");
    const [body, mac] = value.split(".");
    const tampered = Buffer.from(JSON.stringify({ challengeId: "xyz", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyToken(`${tampered}.${mac}`, "test-secret")).toBeNull();
    expect(verifyToken(`${body}.${mac}x`, "test-secret")).toBeNull();
  });

  it("rejects another secret", () => {
    const { value } = signToken({ challengeId: "abc" }, 60, "test-secret");
    expect(verifyToken(value, "another-secret")).toBeNull();
  });

  it("rejects an expired token", () => {
    const { value } = signToken({ challengeId: "abc" }, -1, "test-secret");
    expect(verifyToken(value, "test-secret")).toBeNull();
  });

  it("rejects junk", () => {
    expect(verifyToken(null, "test-secret")).toBeNull();
    expect(verifyToken("nonsense", "test-secret")).toBeNull();
    expect(verifyToken("a.b", "test-secret")).toBeNull();
  });

  it("requires a strong secret in production", () => {
    expect(() => tokenSecret({ NODE_ENV: "production", SECURITY_TOKEN_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow();
  });
});

describe("redirect safety", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/dashboard/settings")).toBe("/dashboard/settings");
    expect(safeNextPath("/dashboard?tab=2")).toBe("/dashboard?tab=2");
  });

  it("blocks external and weird paths", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/ok\u0000bad")).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });
});

describe("device labels", () => {
  it("names the common browser and system families", () => {
    expect(uaFamily("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36")).toBe("Chrome on Windows");
    expect(uaFamily("Mozilla/5.0 (Macintosh) Version/17 Safari/605.1")).toBe("Safari on macOS");
    expect(uaFamily("Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0")).toBe("Firefox on Linux");
    expect(uaFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17 Mobile Safari/604.1")).toBe(
      "Safari on iOS",
    );
  });

  it("never returns an empty label", () => {
    expect(uaFamily(null)).toBe("Unknown browser");
  });
});

describe("session id decoding", () => {
  it("reads the session id claim", () => {
    const token = fakeJwt({ sub: "user-1", session_id: "8f6a2c1e-0000-4000-8000-000000000000" });
    expect(sessionIdFromAccessToken(token)).toBe("8f6a2c1e-0000-4000-8000-000000000000");
  });

  it("returns null when the claim is missing or the token is junk", () => {
    expect(sessionIdFromAccessToken(fakeJwt({ sub: "user-1" }))).toBeNull();
    expect(sessionIdFromAccessToken("not-a-token")).toBeNull();
    expect(sessionIdFromAccessToken(null)).toBeNull();
  });
});
