import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const MIN_FILL_SECONDS = 3;
const MAX_AGE_SECONDS = 2 * 60 * 60;

function secret(): string {
  return (
    process.env.FORM_TOKEN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "get-on-form-token-development-secret"
  );
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/**
 * A signed timestamp that is rendered with the form. It stops bots that
 * submit a page they never loaded, and it stops old pages being replayed.
 */
export function createTimeToken(now: number = Date.now()): string {
  const stamp = String(Math.floor(now / 1000));
  return `${stamp}.${sign(stamp)}`;
}

export type TimeTokenResult = "ok" | "too_fast" | "expired" | "invalid";

/** Checks a time token rendered with the form. */
export function verifyTimeToken(
  token: string | null | undefined,
  now: number = Date.now(),
): TimeTokenResult {
  if (!token) return "invalid";
  const [stamp, signature] = token.split(".");
  if (!stamp || !signature) return "invalid";

  const expected = sign(stamp);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return "invalid";

  const issuedAt = Number(stamp) * 1000;
  if (!Number.isFinite(issuedAt)) return "invalid";

  const elapsed = (now - issuedAt) / 1000;
  if (elapsed < MIN_FILL_SECONDS) return "too_fast";
  if (elapsed > MAX_AGE_SECONDS) return "expired";
  return "ok";
}

/** Hashed IP address. The raw address is never stored. */
export function hashIp(ip: string | null | undefined): string {
  const salt = process.env.IP_HASH_SALT ?? "get-on-development-salt";
  const value = ip && ip.trim() ? ip.trim() : "unknown";
  return createHash("sha256").update(`${value}${salt}`).digest("hex");
}
