// Providers known to ignore dots in the local part entirely.
const DOT_IGNORING_PROVIDERS = new Set(["gmail.com", "googlemail.com"]);
// Providers known to ignore repeated dots (collapse ".." -> ".") but not single dots.
const DOT_COLLAPSING_PROVIDERS = new Set(["yahoo.com", "ymail.com", "rocketmail.com"]);

export function canonicalEmail(input: string): string {
  if (typeof input !== "string") return "";
  // NFKC normalise, trim, lowercase.
  let value = input.normalize("NFKC").trim().toLowerCase();
  if (!value) return "";
  // Split local/domain at the last "@" (local parts cannot contain unquoted @).
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return value;
  let local = value.slice(0, at);
  let domain = value.slice(at + 1);

  // Domain to punycode (ACE). Use node's built-in punycode (deprecated but stable).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puny = require("node:punycode") as { toASCII: (s: string) => string };
    domain = puny.toASCII(domain);
  } catch {
    // leave as-is if unavailable
  }
  domain = domain.toLowerCase();

  // Strip +tag from local part for all domains.
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);

  if (DOT_IGNORING_PROVIDERS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  } else if (DOT_COLLAPSING_PROVIDERS.has(domain)) {
    local = local.replace(/\.{2,}/g, ".");
  }

  // Collapse leading/trailing dots in local part (RFC says they are not significant).
  local = local.replace(/^\.+|\.+$/g, "");

  if (!local || !domain) return value;
  return `${local}@${domain}`;
}
