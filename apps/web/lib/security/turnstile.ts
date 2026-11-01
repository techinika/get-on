import { safeFetch } from "@/lib/security/safe-fetch";

const TEST_SECRETS = new Set(["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA"]);

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "failed" | "unavailable" };

/**
 * Server-side Turnstile check. Tokens are single use and are bound to the
 * action and hostname we expect.
 *
 * Verification only runs when BOTH sides of the integration are configured:
 * `TURNSTILE_SECRET_KEY` (server) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client).
 * If only one is set the widget either cannot render (no site key) or cannot
 * be verified (no secret), so requiring a token would either break registration
 * or accept an unverified token. In either case the check is skipped.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  options: { ip?: string | null; action?: string; hostname?: string | null } = {},
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!secret || !siteKey) return { ok: true };
  if (!token) return { ok: false, reason: "missing" };
  // Cloudflare's documented test secrets always pass.
  if (TEST_SECRETS.has(secret)) return { ok: true };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (options.ip) body.set("remoteip", options.ip);
    const response = await safeFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      timeoutMs: 3000,
      maxBytes: 64 * 1024,
      allowedContentTypes: ["application/json"],
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const data = (await response.json()) as { success?: boolean; action?: string; hostname?: string };
    if (!data.success) return { ok: false, reason: "failed" };
    if (options.action && data.action && data.action !== options.action) return { ok: false, reason: "failed" };
    if (options.hostname && data.hostname && data.hostname !== options.hostname) {
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
