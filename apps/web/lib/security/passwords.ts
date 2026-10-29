import { safeFetch } from "@/lib/security/safe-fetch";

/**
 * Password policy. Codes are returned instead of English text so the UI can
 * translate each reason into plain language once.
 *
 * Rules: at least `minLength` (10 by default), at most 128 characters, no
 * composition rules. Rejected: common passwords, passwords that contain the
 * email local part or the display name, repeated or sequential patterns, and
 * passwords found in the Have I Been Pwned range API.
 */

export type PasswordErrorCode =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "COMMON"
  | "CONTAINS_PERSONAL"
  | "REPEATED"
  | "SEQUENTIAL"
  | "BREACHED";

export type PasswordCheck = { ok: boolean; errors: PasswordErrorCode[]; score: 0 | 1 | 2 | 3 | 4 };

// The most common passwords seen in breach lists. Keeping a local list means the
// first check never depends on the network.
const COMMON_PASSWORDS = new Set(
  [
    "123456", "123456789", "12345678", "password", "qwerty", "12345", "1234567890", "123123", "111111",
    "abc123", "1234567", "password1", "iloveyou", "000000", "qwerty123", "1q2w3e", "aa12345678",
    "abc12345", "1234qwer", "qwertyuiop", "1qaz2wsx", "1q2w3e4r", "qazwsx", "password123", "letmein",
    "welcome", "monkey", "dragon", "master", "sunshine", "princess", "football", "baseball", "superman",
    "trustno1", "hello123", "freedom", "whatever", "starwars", "computer", "michelle", "jennifer",
    "jordan23", "harley", "hunter", "ranger", "buster", "soccer", "batman", "shadow", "michael",
    "mustang", "killer", "george", "sexy", "andrew", "charlie", "thomas", "robert", "access",
    "loveyou", "zaq12wsx", "qwe123", "asdfgh", "zxcvbn", "asdfghjkl", "qwertyui", "1qazxsw2",
    "passw0rd", "p@ssw0rd", "admin123", "root", "toor", "changeme", "secret", "login", "guest",
    "default", "test1234", "welcome1", "welcome123", "letmein123", "football1", "baseball1",
    "summer2023", "summer2024", "winter2023", "winter2024", "spring2024", "autumn2024", "january2024",
    "iloveyou1", "iloveyou2", "lovely", "mypassword", "newpassword", "temppassword", "temporary",
    "office2024", "company123", "business123", "geton123", "geton1234", "get-on", "website123",
    "website2024", "qwerty12", "qwerty1234", "1password", "password12", "password1234", "pass1234",
    "abcd1234", "abcdef123", "a1b2c3d4", "1a2b3c4d", "q1w2e3r4", "1q2w3e4r5t", "zaq1zaq1",
    "qazxsw", "poiuyt", "lkjhgf", "mnbvcx", "0987654321", "987654321", "121212", "112233",
    "654321", "666666", "888888", "999999", "123321", "102030", "147258", "159753", "123qwe",
    "qweasd", "asdqwe", "qweasdzxc", "asdf1234", "zxcv1234", "qazwsx123", "qazwsxedc",
  ].map((value) => value.toLowerCase()),
);

const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "01234567890",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

function isSequential(lower: string): boolean {
  if (lower.length < 4) return false;
  for (const source of SEQUENCES) {
    for (let i = 0; i <= source.length - 4; i += 1) {
      const run = source.slice(i, i + 4);
      const reversed = run.split("").reverse().join("");
      if (lower.includes(run) || lower.includes(reversed)) return true;
    }
  }
  return false;
}

function isRepeated(lower: string): boolean {
  return /(.)\1{3,}/.test(lower);
}

function personalTokens(email: string | undefined, name: string | undefined): string[] {
  const tokens: string[] = [];
  if (email) {
    const local = email.split("@")[0] ?? "";
    const cleaned = local.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (cleaned.length >= 3) tokens.push(cleaned);
    for (const part of local.split(/[._-]+/)) {
      if (part.length >= 3) tokens.push(part.toLowerCase());
    }
  }
  if (name) {
    const cleaned = name.trim().toLowerCase();
    if (cleaned.length >= 3) tokens.push(cleaned.replace(/\s+/g, ""));
    for (const part of cleaned.split(/\s+/)) if (part.length >= 3) tokens.push(part);
  }
  return tokens;
}

/** Rough strength estimate for the bar in the UI (0 to 4). */
export function passwordScore(password: string, inputs: { email?: string; name?: string } = {}): 0 | 1 | 2 | 3 | 4 {
  const value = String(password ?? "");
  if (!value) return 0;
  const lower = value.toLowerCase();
  let classes = 0;
  if (/[a-z]/.test(value)) classes += 1;
  if (/[A-Z]/.test(value)) classes += 1;
  if (/[0-9]/.test(value)) classes += 1;
  if (/[^A-Za-z0-9]/.test(value)) classes += 1;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (classes >= 3) score += 1;
  if (value.length >= 20) score += 1;

  if (COMMON_PASSWORDS.has(lower) || isRepeated(lower) || isSequential(lower)) score = 0;
  if (personalTokens(inputs.email, inputs.name).some((token) => token.length >= 3 && lower.includes(token))) {
    score = Math.min(score, 1);
  }
  return Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;
}

export function checkPasswordPolicy(
  password: string,
  options: { email?: string; name?: string; minLength?: number } = {},
): PasswordCheck {
  const minLength = options.minLength ?? 10;
  const value = String(password ?? "");
  const lower = value.toLowerCase();
  const errors: PasswordErrorCode[] = [];

  if (value.length < minLength) errors.push("TOO_SHORT");
  if (value.length > 128) errors.push("TOO_LONG");
  if (COMMON_PASSWORDS.has(lower)) errors.push("COMMON");
  if (isRepeated(lower)) errors.push("REPEATED");
  if (isSequential(lower)) errors.push("SEQUENTIAL");
  if (personalTokens(options.email, options.name).some((token) => token.length >= 3 && lower.includes(token))) {
    errors.push("CONTAINS_PERSONAL");
  }

  return { ok: errors.length === 0, errors, score: passwordScore(value, options) };
}

export type BreachResult = { breached: boolean; checked: boolean; count?: number };

/**
 * Have I Been Pwned range API with k-anonymity: only the first five characters
 * of the SHA-1 hash leave the server. A timeout or outage fails open (the
 * password is accepted) and is logged as a warning, as the spec requires.
 */
export async function isPasswordBreached(password: string, enabled = true): Promise<BreachResult> {
  if (!enabled) return { breached: false, checked: false };
  try {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha1").update(String(password)).digest("hex").toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const response = await safeFetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeoutMs: 2000,
      maxBytes: 512 * 1024,
      allowedContentTypes: ["text/plain"],
      headers: { "Add-Padding": "true", "User-Agent": "get-on-password-check" },
    });
    if (!response.ok) {
      console.warn("[security] password breach check failed with status", response.status);
      return { breached: false, checked: false };
    }
    const body = await response.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate?.toUpperCase() === suffix) {
        return { breached: true, checked: true, count: Number(count ?? 0) };
      }
    }
    return { breached: false, checked: true };
  } catch (error) {
    console.warn("[security] password breach check unavailable:", (error as Error)?.message ?? error);
    return { breached: false, checked: false };
  }
}
