import { createHmac, timingSafeEqual } from "node:crypto";

const DEV_SECRET = "dev-security-token-secret-change-me";

export function tokenSecret(source: NodeJS.ProcessEnv = process.env): string {
  const secret = source.SECURITY_TOKEN_SECRET ?? source.OTP_PEPPER;
  if (source.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("SECURITY_TOKEN_SECRET must be set to at least 32 characters in production.");
    }
  }
  return secret ?? DEV_SECRET;
}

export type SignedToken = { value: string; expiresAt: number };

/**
 * Small signed value for short-lived state that must survive a redirect but
 * must not be readable or editable by the browser (it lives in an HttpOnly
 * cookie). Format: base64url(json).base64url(hmac).
 */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number, secret = tokenSecret()): SignedToken {
  const exp = Date.now() + ttlSeconds * 1000;
  const body = Buffer.from(JSON.stringify({ ...payload, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return { value: `${body}.${mac}`, expiresAt: exp };
}

export function verifyToken(token: string | null | undefined, secret = tokenSecret()): Record<string, unknown> | null {
  if (!token || typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (Buffer.byteLength(mac) !== Buffer.byteLength(expected)) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
