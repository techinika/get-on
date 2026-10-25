import { isReservedSubdomain } from "./reserved";

export const DEFAULT_ROOT_DOMAIN = "get-on.tech";

export type HostParse =
  | { ok: true; name: string; hostname: string; custom?: false }
  | { ok: true; name: string; hostname: string; custom: true }
  | { ok: false; reason: "invalid" | "reserved" | "apex" };

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Turns a Host header into the name of a customer website.
 *
 * `rosebakery.get-on.tech` becomes `rosebakery`. The root domain itself, a
 * host with more than one label before the root, an IP address and a
 * reserved name are all rejected.
 */
export function parseHost(
  hostHeader: string | null | undefined,
  rootDomain = DEFAULT_ROOT_DOMAIN,
): HostParse {
  if (!hostHeader) return { ok: false, reason: "invalid" };

  const hostname = hostHeader.trim().toLowerCase().split(":")[0] ?? "";
  if (!hostname) return { ok: false, reason: "invalid" };

  // An IP address is never a customer website.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")) {
    return { ok: false, reason: "invalid" };
  }

  const root = rootDomain.toLowerCase();
  if (hostname === root) return { ok: false, reason: "apex" };

  if (hostname.endsWith(`.${root}`)) {
    const name = hostname.slice(0, -(root.length + 1));
    if (!name || name.includes(".")) return { ok: false, reason: "invalid" };
    if (!LABEL_RE.test(name)) return { ok: false, reason: "invalid" };
    if (isReservedSubdomain(name)) return { ok: false, reason: "reserved" };

    return { ok: true, name, hostname };
  }

  // A customer address on their own domain. The database decides whether it
  // is connected; the serving layer only accepts a well-formed host name.
  if (hostname.length > 253) return { ok: false, reason: "invalid" };
  const labels = hostname.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL_RE.test(label))) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, name: hostname, hostname, custom: true };
}
