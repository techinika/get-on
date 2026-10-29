import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export type SafeFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs?: number;
  maxBytes?: number;
  allowedContentTypes?: string[];
  maxRedirects?: number;
  allowHttp?: boolean;
};

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const BLOCKED_V4 = [
  // loopback
  { net: "127.0.0.0", mask: 8 },
  // link-local
  { net: "169.254.0.0", mask: 16 },
  // private 10/8
  { net: "10.0.0.0", mask: 8 },
  // private 172.16/12
  { net: "172.16.0.0", mask: 12 },
  // private 192.168/16
  { net: "192.168.0.0", mask: 16 },
  // CGNAT 100.64/10
  { net: "100.64.0.0", mask: 10 },
  // multicast 224/4
  { net: "224.0.0.0", mask: 4 },
  // reserved 240/4
  { net: "240.0.0.0", mask: 4 },
  // metadata (also link-local, covered)
  { net: "169.254.169.254", mask: 32 },
];

function ip4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return -1;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inV4Range(ip: string, net: string, mask: number): boolean {
  const ipInt = ip4ToInt(ip);
  const netInt = ip4ToInt(net);
  if (ipInt < 0 || netInt < 0) return false;
  const shift = 32 - mask;
  return (ipInt >>> shift) === (netInt >>> shift);
}

function isBlockedV4(ip: string): boolean {
  if (ip === "0.0.0.0") return true;
  for (const r of BLOCKED_V4) {
    if (inV4Range(ip, r.net, r.mask)) return true;
  }
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // loopback
  if (lower === "::1" || lower === "::") return true;
  // unique local fc00::/7
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  // multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(lower)) return true;
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = lower.match(/^::ffff:(.+)$/);
  if (mapped) {
    const v4 = mapped[1];
    // could be hex form ::ffff:7f00:1
    if (v4.includes(":")) {
      // convert last two groups to v4
      const groups = v4.split(":");
      if (groups.length === 2) {
        const hi = parseInt(groups[0], 16);
        const lo = parseInt(groups[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const a = (hi >> 8) & 0xff;
          const b = hi & 0xff;
          const c = (lo >> 8) & 0xff;
          const d = lo & 0xff;
          return isBlockedV4(`${a}.${b}.${c}.${d}`);
        }
      }
    } else {
      return isBlockedV4(v4);
    }
  }
  // metadata IPv6 (AWS fd00:ec2::254 already ULA-covered)
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true; // unknown -> block
}

function isSuspiciousHostForm(host: string): boolean {
  // pure decimal
  if (/^\d+$/.test(host)) return true;
  // octal-ish
  if (/^0[0-7.]+$/.test(host)) return true;
  // hex-ish
  if (/^0x/i.test(host)) return true;
  // IP literal with brackets
  if (host.startsWith("[") || host.endsWith("]")) {
    const inner = host.replace(/^\[|\]$/g, "");
    if (isIP(inner) !== 0) return isBlockedIp(inner);
    return true;
  }
  return false;
}

async function resolveHost(host: string): Promise<string[]> {
  if (isIP(host) !== 0) return [host];
  if (isSuspiciousHostForm(host)) throw new SafeFetchError("blocked host form");
  try {
    const res = await lookup(host, { all: true });
    return res.map((r) => r.address);
  } catch {
    throw new SafeFetchError("dns resolution failed");
  }
}

function validateUrl(raw: string | URL, allowHttp: boolean): URL {
  let url: URL;
  try {
    url = raw instanceof URL ? new URL(raw.toString()) : new URL(raw);
  } catch {
    throw new SafeFetchError("invalid url");
  }
  if (url.username || url.password) throw new SafeFetchError("credentials in url");
  const scheme = url.protocol.replace(":", "");
  if (scheme === "https") {
    // ok
  } else if (scheme === "http" && allowHttp) {
    // ok (tests only)
  } else {
    throw new SafeFetchError("scheme not allowed");
  }
  const port = url.port || (scheme === "https" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new SafeFetchError("port not allowed");
  return url;
}

export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const allowHttp = options.allowHttp === true;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let url = validateUrl(input, allowHttp);

  // Resolve and check the host.
  const checkHost = async (u: URL) => {
    const host = u.hostname;
    if (isSuspiciousHostForm(host)) throw new SafeFetchError("blocked host form");
    const ips = await resolveHost(host);
    if (ips.length === 0) throw new SafeFetchError("no addresses");
    for (const ip of ips) {
      if (isBlockedIp(ip)) throw new SafeFetchError("blocked address");
    }
  };

  let redirects = 0;
  // We'll perform fetch manually to re-validate each hop.
  // Use a loop with fetch redirect: "manual".
  while (true) {
    await checkHost(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body ?? null,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      throw new SafeFetchError(`fetch failed: ${(e as Error)?.message ?? e}`);
    }
    clearTimeout(timer);

    // Redirect handling.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      if (redirects >= maxRedirects) throw new SafeFetchError("too many redirects");
      redirects += 1;
      const next = new URL(loc, url);
      // validate scheme/port again
      validateUrl(next, allowHttp);
      url = next;
      continue;
    }

    // Content-type allow-list.
    if (options.allowedContentTypes && options.allowedContentTypes.length > 0) {
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const ok = options.allowedContentTypes.some((t) => ct.includes(t.toLowerCase()));
      if (!ct || !ok) throw new SafeFetchError("content type not allowed");
    }

    // Size cap: read body with limit.
    // Return a new Response with the body buffered, capped.
    const reader = res.body?.getReader();
    if (!reader) return res;
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            throw new SafeFetchError("response too large");
          }
          chunks.push(value);
        }
      }
    } catch (e) {
      if (e instanceof SafeFetchError) throw e;
      throw new SafeFetchError(`body read failed: ${(e as Error)?.message ?? e}`);
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.byteLength;
    }
    return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
  }
}
