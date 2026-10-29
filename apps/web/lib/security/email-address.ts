import { createAdminClient } from "@/lib/supabase/admin";

const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DOMAIN_PART = /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// A short local list so the check still works when the database lookup fails.
const STATIC_DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "yopmail.net", "trashmail.com",
  "sharklasers.com", "dispostable.com", "getnada.com", "maildrop.cc", "spamgourmet.com",
  "mailnesia.com", "mintemail.com", "mytemp.email", "tempinbox.com", "fakeinbox.com",
  "emailondeck.com", "moakt.com", "burnermail.io", "tempmailo.com", "mailcatch.com",
]);

export type EmailValidation =
  | { ok: true; email: string; local: string; domain: string }
  | { ok: false; code: "AUTH_EMAIL_INVALID" };

/**
 * Pragmatic RFC-aware check: practical enough to reject garbage without
 * rejecting real addresses. Internationalised domains are converted by the
 * canonical helper before the domain part is checked.
 */
export function validateEmailAddress(input: unknown): EmailValidation {
  if (typeof input !== "string") return { ok: false, code: "AUTH_EMAIL_INVALID" };
  const trimmed = input.normalize("NFKC").trim();
  if (!trimmed || trimmed.length > 254) return { ok: false, code: "AUTH_EMAIL_INVALID" };
  if (/\s/.test(trimmed)) return { ok: false, code: "AUTH_EMAIL_INVALID" };

  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return { ok: false, code: "AUTH_EMAIL_INVALID" };
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();

  if (local.length > 64) return { ok: false, code: "AUTH_EMAIL_INVALID" };
  if (!LOCAL_PART.test(local)) return { ok: false, code: "AUTH_EMAIL_INVALID" };
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, code: "AUTH_EMAIL_INVALID" };
  }
  if (domain.length > 253 || domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) {
    return { ok: false, code: "AUTH_EMAIL_INVALID" };
  }
  if (!domain.includes(".")) return { ok: false, code: "AUTH_EMAIL_INVALID" };
  // Allow punycode labels (xn--) as well as plain ASCII labels.
  if (!DOMAIN_PART.test(domain) && !/^[A-Za-z0-9.-]+\.xn--[A-Za-z0-9-]+$/.test(domain)) {
    return { ok: false, code: "AUTH_EMAIL_INVALID" };
  }

  return { ok: true, email: `${local}@${domain}`, local, domain };
}

export function staticDisposableDomain(domain: string): boolean {
  return STATIC_DISPOSABLE.has(domain.toLowerCase());
}

export async function isDisposableDomain(domain: string): Promise<boolean> {
  const lowered = domain.toLowerCase();
  if (STATIC_DISPOSABLE.has(lowered)) return true;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("disposable_email_domains")
      .select("domain")
      .eq("domain", lowered)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function isBlockedDomain(domain: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("blocked_email_domains")
      .select("domain")
      .eq("domain", domain.toLowerCase())
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}
