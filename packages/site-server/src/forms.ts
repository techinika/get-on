/**
 * Form tokens and worker request signatures. These run everywhere: the
 * Cloudflare Worker, the Node adapter and the Next app, so they use WebCrypto
 * only.
 */

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function textEncoder() {
  return new TextEncoder();
}

function bytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength) as Uint8Array<ArrayBuffer>;
  copy.set(value);
  return copy;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    bytes(textEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, bytes(textEncoder().encode(message)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const data = bytes(typeof value === "string" ? textEncoder().encode(value) : value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export type FormTokenPayload = {
  s: string;
  f: string;
  t: number;
};

/** Signs a form token: v1.{payload}.{signature} */
export async function signFormToken(
  secret: string,
  payload: FormTokenPayload,
): Promise<string> {
  const body = base64url(textEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, bytes(textEncoder().encode(`v1.${body}`)));
  return `v1.${body}.${base64url(new Uint8Array(sig))}`;
}

export type VerifyResult =
  | { ok: true; payload: FormTokenPayload }
  | { ok: false; reason: "format" | "signature" | "expired" };

export async function verifyFormToken(
  secrets: string[],
  token: string,
  now: number = Date.now(),
): Promise<VerifyResult> {
  if (!token || typeof token !== "string") return { ok: false, reason: "format" };
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false, reason: "format" };
  const [, body, sig] = parts as [string, string, string];
  let payload: FormTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
  } catch {
    return { ok: false, reason: "format" };
  }
  if (typeof payload?.s !== "string" || typeof payload?.f !== "string" || typeof payload?.t !== "number") {
    return { ok: false, reason: "format" };
  }
  const expected = bytes(textEncoder().encode(`v1.${body}`));
  let valid = false;
  for (const secret of secrets) {
    if (!secret) continue;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, bytes(fromBase64url(sig)), expected);
    if (ok) {
      valid = true;
      break;
    }
  }
  if (!valid) return { ok: false, reason: "signature" };
  // 7 day expiry window. Older pages are rejected; tokens 24 hours old are
  // still accepted and scored as spam by the app.
  const age = now - payload.t;
  if (age > 7 * 24 * 60 * 60 * 1000) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

/** Signs a worker forwarding request. */
export async function signWorkerRequest(
  secret: string,
  parts: { ts: string; host: string; ip: string; bodyHash: string },
): Promise<string> {
  return hmacHex(secret, [parts.ts, parts.host, parts.ip, parts.bodyHash].join("\n"));
}

export async function verifyWorkerRequest(
  secret: string,
  parts: { ts: string; host: string; ip: string; bodyHash: string; sig: string },
  now: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const expected = await signWorkerRequest(secret, parts);
  if (expected.length !== parts.sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ parts.sig.charCodeAt(i);
  }
  if (diff !== 0) return false;
  const age = Math.abs(now - Number(parts.ts));
  return age <= 60;
}

export function sanitizeBackPath(value: string | null | undefined): string {
  if (!value) return "/";
  const clean = value.trim();
  if (!/^\/[a-z0-9/_-]{0,200}$/.test(clean)) return "/";
  return clean;
}

export const PROBLEM_TEXTS: Record<string, string> = {
  invalid: "Please check your details and try again.",
  rate: "You have sent a few messages already. Please wait a little and try again.",
  closed: "This form is not taking messages right now.",
  unavailable: "Something went wrong on our side. Please try again in a moment.",
};

export function sanitizeProblemCode(value: string | null | undefined): string {
  const code = (value ?? "").trim();
  if (code in PROBLEM_TEXTS) return code;
  return "unavailable";
}
