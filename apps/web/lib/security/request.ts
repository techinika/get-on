import { hashIp } from "@/lib/spam";

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? null;
}

export function getIpHash(headers: Headers): string {
  return hashIp(getClientIp(headers));
}

/**
 * "Chrome on Windows" style label. Only the family is stored, never the full
 * user agent string.
 */
export function uaFamily(userAgent: string | null | undefined): string {
  const ua = String(userAgent ?? "");
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${system}`;
}

/** Only same-site relative paths, so a `next` parameter cannot become an open redirect. */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  const path = typeof value === "string" ? value : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(path)) return fallback;
  return path;
}

/**
 * Origin check for state-changing requests. Browsers send `Origin` on every
 * cross-site POST; a missing header is only accepted for same-origin form posts
 * when `Sec-Fetch-Site` says so.
 */
export function isSameOrigin(request: Request, extraOrigins: string[] = []): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const allowed = new Set<string>();
  if (host) allowed.add(`${proto}://${host}`);
  for (const value of extraOrigins) if (value) allowed.add(value.replace(/\/$/, ""));

  if (origin) return allowed.has(origin);
  if (fetchSite === "same-origin" || fetchSite === "none") return true;
  return false;
}
