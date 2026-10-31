/**
 * Web-address helpers. The user-facing term is always "web address";
 * the words slug/subdomain/DNS never appear in UI copy.
 */

const ADDRESS_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export const SUBDOMAIN_MIN_LENGTH = 5;
export const SUBDOMAIN_MAX_LENGTH = 40;

export const FREE_SUFFIX = ".get-on.tech";

export type AddressCheck =
  | { status: "available" }
  | { status: "taken" }
  | { status: "reserved" }
  | { status: "invalid"; reason: string };

export function normalizeAddress(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateAddress(raw: string): { ok: boolean; reason?: string } {
  const value = normalizeAddress(raw);
  if (value.length < SUBDOMAIN_MIN_LENGTH) {
    return { ok: false, reason: `Use at least ${SUBDOMAIN_MIN_LENGTH} characters.` };
  }
  if (value.length > SUBDOMAIN_MAX_LENGTH) {
    return { ok: false, reason: `Use ${SUBDOMAIN_MAX_LENGTH} characters or fewer.` };
  }
  if (!ADDRESS_RE.test(value)) {
    return {
      ok: false,
      reason: "Please use only letters, numbers and dashes.",
    };
  }
  return { ok: true };
}

/** Suggest up to 3 alternatives when an address is taken. */
export function suggestAddresses(base: string, count = 3): string[] {
  const root = normalizeAddress(base).replace(/-+/g, "").slice(0, 50) || "mysite";
  const out: string[] = [];
  for (let i = 2; out.length < count && i < 50; i++) {
    out.push(`${root}-${i}`);
  }
  if (out.length < count) {
    const suffix = crypto.randomUUID().replace(/[^a-z0-9]/g, "").slice(0, 4);
    out.push(`${root}-${suffix}`);
  }
  return out;
}

/** Turn a business name into a starting address candidate. */
export function addressFromName(name: string): string {
  return normalizeAddress(name);
}
