import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export type OtpPepper = { version: number; secret: string };

const DEV_PEPPER = "dev-otp-pepper-change-me";
const MIN_PEPPER_LENGTH = 32;

/**
 * Peppers are versioned so a rotation does not invalidate codes that are still
 * inside their lifetime. `OTP_PEPPER_VERSION` names the current version; the
 * previous secret is kept for one rotation.
 */
export function loadPeppers(source: NodeJS.ProcessEnv = process.env): OtpPepper[] {
  const currentVersion = Number(source.OTP_PEPPER_VERSION ?? "1");
  const current = source.OTP_PEPPER;
  const previous = source.OTP_PEPPER_PREVIOUS;

  if (process.env.NODE_ENV === "production") {
    if (!current || current.length < MIN_PEPPER_LENGTH) {
      throw new Error("OTP_PEPPER must be set to at least 32 characters in production.");
    }
  }

  const out: OtpPepper[] = [
    { version: Number.isInteger(currentVersion) && currentVersion > 0 ? currentVersion : 1, secret: current ?? DEV_PEPPER },
  ];
  if (previous) out.push({ version: out[0].version - 1, secret: previous });
  return out;
}

export function currentPepper(source: NodeJS.ProcessEnv = process.env): OtpPepper {
  return loadPeppers(source)[0];
}

export function pepperForVersion(version: number, source: NodeJS.ProcessEnv = process.env): OtpPepper {
  const found = loadPeppers(source).find((p) => p.version === version);
  if (!found) throw new Error("Unknown OTP pepper version.");
  return found;
}

/**
 * Uniform random digits from the platform CSPRNG. Leading zeros are kept.
 * `randomInt` is uniform over the inclusive range, so no modulo bias.
 */
export function generateCode(length = 6, max = 100_000_000): string {
  if (!Number.isInteger(length) || length < 4 || length > 10) throw new Error("Invalid code length.");
  const n = randomInt(0, max);
  return String(n % 10 ** length).padStart(length, "0");
}

/** Codes are typed by people, so spaces and dashes are tolerated, nothing else. */
export function normaliseCode(input: string): string | null {
  const cleaned = String(input ?? "").replace(/[\s-]/g, "");
  return /^[0-9]+$/.test(cleaned) ? cleaned : null;
}

export function isCodeShape(input: string | null, length: number): input is string {
  return typeof input === "string" && input.length === length && /^[0-9]+$/.test(input);
}

/**
 * A challenge hash binds the code to its purpose, subject and challenge id, so
 * one code can never satisfy another purpose, user or browser.
 */
export function challengeHash(
  purpose: string,
  subject: string,
  challengeId: string,
  code: string,
  pepper: string,
): string {
  return createHmac("sha256", pepper).update(`${purpose}|${subject}|${challengeId}|${code}`).digest("hex");
}

export function verifyCodeConstantTime(expectedHash: string, candidateHash: string): boolean {
  if (typeof expectedHash !== "string" || typeof candidateHash !== "string") return false;
  if (expectedHash.length !== candidateHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(candidateHash, "hex"));
  } catch {
    return false;
  }
}

/** Random 32-byte binding value for the `__Host-gs_chal` cookie. */
export function newBindingValue(): string {
  return randomBytes(32).toString("base64url");
}

export function hashBrowserBinding(cookieValue: string, secret: string): string {
  return createHmac("sha256", secret).update(`binding:${cookieValue}`).digest("hex");
}

/** Short hash for an email address. The plain address never goes in this column. */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** Token hash for single-use auth tokens. Only the hash is stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function maskEmail(email: string): string {
  const [local, domain] = String(email).split("@");
  if (!local || !domain) return "your email address";
  return `${local.slice(0, 1)}***@${domain}`;
}
