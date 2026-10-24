import { parse } from "tldts";
import { domainToASCII, domainToUnicode } from "node:url";

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const BLOCKED_LABELS = new Set([
  "_geton-verify",
  "autodiscover",
  "autoconfig",
  "mail",
  "smtp",
  "imap",
  "pop",
  "webmail",
  "ftp",
  "localhost",
]);

export type NormalizedDomain = {
  registrable: string;
  sld: string;
  hostname: string;
  subdomain: string | null;
  suggestedLabel: string | null;
  unicodeHost: string;
};

export type NormalizeResult =
  | { ok: true; domain: NormalizedDomain }
  | { ok: false; reason: "invalid" | "ip" | "reserved" | "public-suffix" };

function stripInput(input: string): string {
  let value = input.trim();
  const scheme = value.indexOf("://");
  if (scheme >= 0) value = value.slice(scheme + 3);
  value = value.split(/[/?#]/, 1)[0] ?? "";
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.$/, "");
  return value.toLowerCase();
}

function toAscii(host: string): string {
  const ascii = domainToASCII(host);
  return (ascii || "").toLowerCase().replace(/\.$/, "");
}

function labelsValid(host: string, allowLocalhost = false): boolean {
  if (!host || host.length > 253) return false;
  const labels = host.split(".");
  if (labels.length < 2) return allowLocalhost && host === "localhost";
  return labels.every((label) => LABEL.test(label));
}

/**
 * Accepts what a customer may paste: a full URL, a host with a port, a bare
 * domain or a subdomain. Returns the registrable domain plus the address they
 * asked for. IPs and public suffixes are not domains you can connect.
 */
export function normalizeDomainInput(input: string): NormalizeResult {
  const stripped = stripInput(input);
  if (!stripped || stripped.includes("@") || stripped.includes(":")) {
    return { ok: false, reason: "invalid" };
  }
  if (stripped.includes("_")) return { ok: false, reason: "invalid" };

  const hostname = toAscii(stripped);
  if (!labelsValid(hostname)) return { ok: false, reason: "invalid" };

  const parsed = parse(hostname, {
    allowIcannDomains: true,
    allowPrivateDomains: true,
    detectIp: true,
    detectSpecialUse: true,
    extractHostname: false,
    mixedInputs: false,
    validateHostname: true,
  });
  if (parsed.isIp) return { ok: false, reason: "ip" };
  if (parsed.isSpecialUse) return { ok: false, reason: "reserved" };
  if (!parsed.domain || !parsed.publicSuffix) {
    return { ok: false, reason: "public-suffix" };
  }
  if (parsed.domain === parsed.publicSuffix) {
    return { ok: false, reason: "public-suffix" };
  }

  const subdomain = parsed.subdomain || null;
  const suggestedLabel =
    subdomain && !subdomain.includes(".") && !BLOCKED_LABELS.has(subdomain)
      ? subdomain
      : null;

  return {
    ok: true,
    domain: {
      registrable: parsed.domain,
      sld: parsed.domainWithoutSuffix ?? parsed.domain.split(".")[0] ?? "",
      hostname,
      subdomain,
      suggestedLabel,
      unicodeHost: domainToUnicode(hostname) || hostname,
    },
  };
}

/** Lowercases a Host header or stored hostname and removes a port/trailing dot. */
export function normalizeHostname(input: string): string | null {
  const hostname = toAscii(stripInput(input));
  if (!labelsValid(hostname, true)) return null;
  const parsed = parse(hostname, {
    allowIcannDomains: true,
    allowPrivateDomains: true,
    detectIp: true,
    detectSpecialUse: true,
    extractHostname: false,
    mixedInputs: false,
    validateHostname: true,
  });
  if (parsed.isIp) return null;
  return hostname;
}

export function isPlatformHost(hostname: string, rootDomain: string): boolean {
  const host = normalizeHostname(hostname);
  const root = rootDomain.trim().toLowerCase().replace(/\.$/, "");
  if (!host || !root) return false;
  return host === root || host.endsWith(`.${root}`);
}

export function isValidHostnameLabel(label: string): boolean {
  const value = label.trim().toLowerCase();
  if (value === "@") return true;
  if (!LABEL.test(value)) return false;
  return !BLOCKED_LABELS.has(value);
}

export function hostnameForLabel(label: string, registrable: string): string {
  const value = label.trim().toLowerCase();
  return value === "@" ? registrable : `${value}.${registrable}`;
}

export function hostnameLabel(
  hostname: string,
  registrable: string,
): string | null {
  const host = normalizeHostname(hostname);
  const domain = registrable.trim().toLowerCase();
  if (!host) return null;
  if (host === domain) return "@";
  if (!host.endsWith(`.${domain}`)) return null;
  const prefix = host.slice(0, -(domain.length + 1));
  return prefix.includes(".") ? null : prefix;
}

export function otherForm(hostname: string, registrable: string): string | null {
  const label = hostnameLabel(hostname, registrable);
  if (label === "@") return `www.${registrable}`;
  if (label === "www") return registrable;
  return null;
}

export function isWwwOrBare(hostname: string, registrable: string): boolean {
  const label = hostnameLabel(hostname, registrable);
  return label === "@" || label === "www";
}
