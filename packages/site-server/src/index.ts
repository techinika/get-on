export const DEFAULT_ROOT_DOMAIN = "get-on.tech";

export type SiteState =
  | "live"
  | "offline"
  | "review"
  | "suspended"
  | "unpublished";

export type SitePause = {
  title: string;
  text: string;
  since?: string;
};

export type SiteRedirect = {
  from: string;
  to: string;
  code: number;
};

export type SitePointer = {
  siteId: string;
  publishId: string;
  state: SiteState;
  builtAt: string;
  plan?: string;
  primaryHost?: string | null;
  freeHost?: string | null;
  redirectToPrimary?: boolean;
  redirectFreeAddress?: boolean;
  planLapsed?: boolean;
  supportPaused?: boolean;
  pause?: SitePause | null;
  redirects?: SiteRedirect[];
  links?: Record<string, { url: string; active?: boolean }>;
};

export type SiteFile = {
  body: ArrayBuffer | Uint8Array;
  contentType?: string | null;
  etag?: string | null;
  size?: number;
};

export type StoredObject = SiteFile;

export type SiteLink = {
  v: 1;
  siteId: string;
  projectId: string;
  targetPath: string;
  params?: Record<string, string>;
  active: boolean;
};

export type SiteStore = {
  getPointer(hostname: string): Promise<SitePointer | null>;
  getFile?(
    siteId: string,
    publishId: string,
    filePath: string,
  ): Promise<SiteFile | null>;
  getSharedFile?(filePath: string): Promise<SiteFile | null>;
  getLink?(code: string): Promise<SiteLink | null>;
  getObject?(key: string): Promise<SiteFile | null>;
};

export type ParseHostResult =
  | { ok: true; hostname: string; custom: false; name: string }
  | { ok: true; hostname: string; custom: true; name: string }
  | { ok: false; reason: string };

export function parseHost(
  rawHost: string | null | undefined,
  rootDomain = DEFAULT_ROOT_DOMAIN,
): ParseHostResult {
  if (!rawHost) return { ok: false, reason: "missing_host" };
  const cleaned = rawHost.trim().toLowerCase().split(":")[0] ?? "";
  if (!cleaned || /[^a-z0-9.-]/.test(cleaned)) {
    return { ok: false, reason: "invalid_host" };
  }
  const normalizedRoot =
    rootDomain.trim().toLowerCase().split(":")[0] ?? DEFAULT_ROOT_DOMAIN;
  if (cleaned === normalizedRoot || cleaned === `www.${normalizedRoot}`) {
    return { ok: false, reason: "root_domain" };
  }
  const suffix = `.${normalizedRoot}`;
  if (cleaned.endsWith(suffix)) {
    const sub = cleaned.slice(0, -suffix.length);
    if (!sub || sub.includes(".")) {
      return { ok: false, reason: "invalid_subdomain" };
    }
    return { ok: true, hostname: cleaned, custom: false, name: sub };
  }
  return { ok: true, hostname: cleaned, custom: true, name: cleaned };
}

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function contentTypeFor(filePath: string): string {
  const idx = filePath.lastIndexOf(".");
  if (idx === -1) return "application/octet-stream";
  const ext = filePath.slice(idx).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return bytesToHex(digest);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signWorkerRequest(
  secret: string,
  input: { ts: string; host: string; ip: string; bodyHash: string },
): Promise<string> {
  const payload = `${input.ts}.${input.host}.${input.ip}.${input.bodyHash}`;
  return hmacSign(secret, payload);
}

export async function verifyWorkerRequest(
  secret: string,
  input: { ts: string; host: string; ip: string; bodyHash: string; sig: string },
): Promise<boolean> {
  if (!secret || !input.ts || !input.sig) return false;
  const tsNum = Number(input.ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) return false;
  const expected = await signWorkerRequest(secret, input);
  return constantTimeEqual(expected, input.sig.toLowerCase());
}

export type FormTokenPayload = { s: string; f: string; t: number };

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const mod = padded.length % 4;
  return atob(mod === 0 ? padded : padded + "=".repeat(4 - mod));
}

export async function signFormToken(
  secret: string,
  payload: FormTokenPayload,
): Promise<string> {
  const body = toBase64Url(JSON.stringify(payload));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifyFormToken(
  secrets: string[],
  token: string,
): Promise<{ ok: true; payload: FormTokenPayload } | { ok: false }> {
  if (!token || !token.includes(".")) return { ok: false };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false };
  for (const secret of secrets) {
    if (!secret) continue;
    const expected = await hmacSign(secret, body);
    if (constantTimeEqual(expected, sig.toLowerCase())) {
      try {
        const parsed = JSON.parse(fromBase64Url(body)) as FormTokenPayload;
        if (
          typeof parsed.s === "string" &&
          typeof parsed.f === "string" &&
          typeof parsed.t === "number"
        ) {
          return { ok: true, payload: parsed };
        }
      } catch {
        return { ok: false };
      }
    }
  }
  return { ok: false };
}

export type HandleSiteRequestOptions = {
  rootDomain?: string;
  rawPath?: string;
  formTokenSecret?: string;
  formTokenSecretPrevious?: string;
  workerSharedSecret?: string;
  appOrigin?: string;
  clientIp?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
  statsSaltSecret?: string;
};

const FORM_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const MAX_FORM_BODY_BYTES = 16 * 1024;
const SITE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'";

function sanitizePath(rawPath: string): string {
  const clean = rawPath.split("?")[0]?.split("#")[0] ?? "/";
  if (clean.includes("..")) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function securityHeaders(isHtml: boolean): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...(isHtml ? { "Content-Security-Policy": SITE_CSP } : {}),
  };
}

function byteLengthOf(body: ArrayBuffer | Uint8Array): number {
  return body instanceof Uint8Array ? body.byteLength : body.byteLength;
}

function normalizeEtag(value: string): string {
  return value.trim().replace(/^W\//i, "").replace(/^"|"$/g, "");
}

function etagMatches(header: string | null, fileEtag: string | null | undefined): boolean {
  if (!header || !fileEtag) return false;
  const target = normalizeEtag(fileEtag);
  return header
    .split(",")
    .map((part) => normalizeEtag(part))
    .some((part) => part === "*" || part === target);
}

function cacheControlFor(filePath: string): string {
  if (
    filePath.startsWith("_shared/") ||
    filePath.startsWith("assets/") ||
    filePath.startsWith("media/")
  ) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=60, stale-while-revalidate=300";
}

async function readSharedFromStore(
  store: SiteStore,
  relPath: string,
): Promise<SiteFile | null> {
  if (store.getSharedFile) {
    return store.getSharedFile(relPath);
  }
  if (store.getObject) {
    return store.getObject(`sites/_shared/${relPath}`);
  }
  return null;
}

async function readSiteFileFromStore(
  store: SiteStore,
  siteId: string,
  publishId: string,
  relPath: string,
): Promise<SiteFile | null> {
  if (store.getFile) {
    return store.getFile(siteId, publishId, relPath);
  }
  if (store.getObject) {
    return store.getObject(`sites/${siteId}/v/${publishId}/${relPath}`);
  }
  return null;
}

function sendSignedStats(
  options: HandleSiteRequestOptions,
  hostname: string,
  payload: Record<string, unknown>,
): void {
  const origin = options.appOrigin?.replace(/\/$/, "");
  const secret = options.workerSharedSecret;
  if (!origin || !secret) return;
  const body = JSON.stringify(payload);
  const run = async () => {
    try {
      const ts = String(Date.now());
      const ip = options.clientIp ?? "";
      const bodyHash = await sha256Hex(body);
      const sig = await signWorkerRequest(secret, { ts, host: hostname, ip, bodyHash });
      await fetch(`${origin}/api/stats/ingest`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gs-host": hostname,
          "x-gs-ip": ip,
          "x-gs-ts": ts,
          "x-gs-sig": sig,
        },
        body,
      });
    } catch {
      // Best-effort analytics must never break redirects or page delivery.
    }
  };
  const promise = run();
  options.waitUntil?.(promise);
}

function respondWithFile(
  request: Request,
  file: SiteFile,
  relPath: string,
  status = 200,
  overrideCacheControl?: string,
): Response {
  const contentType = file.contentType ?? contentTypeFor(relPath);
  const isHtml = contentType.toLowerCase().includes("text/html");
  const cacheControl = overrideCacheControl ?? cacheControlFor(relPath);
  const size = file.size ?? byteLengthOf(file.body);
  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    ...securityHeaders(isHtml),
    ...(file.etag ? { ETag: file.etag } : {}),
    ...(status === 404 ? { "X-Robots-Tag": "noindex" } : {}),
  };

  if (status === 200 && etagMatches(request.headers.get("if-none-match"), file.etag)) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  return new Response(request.method === "HEAD" ? null : (file.body as BodyInit), {
    status,
    headers: {
      ...baseHeaders,
      "Content-Length": String(size),
    },
  });
}

export async function handleSiteRequest(
  request: Request,
  store: SiteStore,
  options: HandleSiteRequestOptions = {},
): Promise<Response> {
  const rootDomain = options.rootDomain || DEFAULT_ROOT_DOMAIN;
  const parsedHost = parseHost(request.headers.get("host"), rootDomain);
  if (!parsedHost.ok) {
    return new Response("Site not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        ...securityHeaders(false),
      },
    });
  }

  const reqPath = sanitizePath(options.rawPath ?? new URL(request.url).pathname);

  if (reqPath === "/_gs/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    return new Response(request.method === "HEAD" ? null : "ok", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": "2",
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  const pointer = await store.getPointer(parsedHost.hostname);
  if (!pointer) {
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Site not found</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center"><h1>Website not found</h1><p>No live website is connected to this address yet.</p></body></html>`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(true),
        },
      },
    );
  }

  if (pointer.state === "suspended") {
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Website unavailable</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center"><h1>Website suspended</h1><p>This website is temporarily suspended.</p></body></html>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(true),
        },
      },
    );
  }

  if (pointer.state === "unpublished" || pointer.state === "offline") {
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Website not live yet</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center"><h1>Website not live yet</h1><p>This website is not live yet. Please check back soon.</p></body></html>`,
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(true),
        },
      },
    );
  }

  if (pointer.state !== "live") {
    return new Response("Site unavailable", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        ...securityHeaders(false),
      },
    });
  }

  if (pointer.supportPaused || pointer.planLapsed) {
    const title = escapeHtml(pointer.pause?.title || "Site temporarily unavailable");
    const text = escapeHtml(pointer.pause?.text || "Please check back soon.");
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center"><h1>${title}</h1><p>${text}</p></body></html>`,
      {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(true),
        },
      },
    );
  }

  const tokenMatch = /^\/_forms\/([A-Za-z0-9_-]{6,32})\/token$/.exec(reqPath);
  if (tokenMatch) {
    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "GET",
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    if (!options.formTokenSecret) {
      return new Response(JSON.stringify({ ok: false, error: "form_unavailable" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    const token = await signFormToken(options.formTokenSecret, {
      s: pointer.siteId,
      f: tokenMatch[1]!,
      t: Date.now(),
    });
    return new Response(JSON.stringify({ ok: true, token }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  const formMatch = /^\/_forms\/([^/]+)$/.exec(reqPath);
  if (formMatch) {
    const formId = formMatch[1]!;
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "POST",
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    if (!FORM_ID_RE.test(formId)) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    const origin = options.appOrigin?.replace(/\/$/, "");
    const secret = options.workerSharedSecret;
    if (!origin || !secret) {
      return new Response(JSON.stringify({ ok: false, error: "form_unavailable" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_FORM_BODY_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "payload_too_large" }), {
        status: 413,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }

    const ts = String(Date.now());
    const ip = options.clientIp ?? "";
    const bodyHash = await sha256Hex(rawBody);
    const sig = await signWorkerRequest(secret, {
      ts,
      host: parsedHost.hostname,
      ip,
      bodyHash,
    });
    const upstream = await fetch(`${origin}/api/public/forms/${encodeURIComponent(formId)}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-gs-host": parsedHost.hostname,
        "x-gs-ip": ip,
        "x-gs-ua": (request.headers.get("user-agent") ?? "").slice(0, 200),
        "x-gs-ts": ts,
        "x-gs-sig": sig,
      },
      body: rawBody,
    });
    const upstreamText = await upstream.text();
    return new Response(upstreamText, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  if (reqPath === "/_gs/stats") {
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "POST",
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          ...securityHeaders(false),
        },
      });
    }
    const raw = await request.text().catch(() => "");
    let pagePath = "/";
    try {
      const parsed = JSON.parse(raw) as { path?: unknown };
      if (typeof parsed.path === "string" && parsed.path.startsWith("/")) {
        pagePath = parsed.path.slice(0, 200);
      }
    } catch {
      // Ignore malformed beacon JSON
    }
    const visitorSeed = `${options.clientIp ?? ""}|${request.headers.get("user-agent") ?? ""}|${options.statsSaltSecret ?? pointer.siteId}`;
    const visitorHash = await sha256Hex(visitorSeed);
    sendSignedStats(options, parsedHost.hostname, {
      kind: "view",
      siteId: pointer.siteId,
      projectId: pointer.siteId,
      path: pagePath,
      visitorHash,
    });
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  if (reqPath.startsWith("/_l/")) {
    const code = reqPath.slice("/_l/".length);
    const link = store.getLink ? await store.getLink(code) : null;
    if (!link || !link.active || (link.siteId && link.siteId !== pointer.siteId)) {
      return new Response("This link is no longer active.", {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(false),
        },
      });
    }
    const dest = new URL(link.targetPath, `https://${parsedHost.hostname}`);
    for (const [k, v] of Object.entries(link.params ?? {})) {
      if (typeof v === "string") dest.searchParams.set(k, v);
    }
    const visitorSeed = `${options.clientIp ?? ""}|${request.headers.get("user-agent") ?? ""}|${options.statsSaltSecret ?? pointer.siteId}`;
    const visitorHash = await sha256Hex(visitorSeed);
    sendSignedStats(options, parsedHost.hostname, {
      kind: "click",
      siteId: pointer.siteId,
      projectId: link.projectId || pointer.siteId,
      path: link.targetPath,
      linkCode: code,
      params: link.params ?? {},
      visitorHash,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: dest.toString(),
        "Cache-Control": "no-store",
        ...securityHeaders(false),
      },
    });
  }

  if (
    !parsedHost.custom &&
    pointer.primaryHost &&
    pointer.redirectFreeAddress !== false &&
    pointer.redirectToPrimary !== false
  ) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `https://${pointer.primaryHost}${reqPath}`,
        "Cache-Control": "public, max-age=60",
        ...securityHeaders(false),
      },
    });
  }

  const redirect = pointer.redirects?.find((r) => r.from === reqPath);
  if (redirect && (/^\//.test(redirect.to) || /^https?:\/\//i.test(redirect.to))) {
    const dest = redirect.to.startsWith("/")
      ? new URL(redirect.to, request.url).toString()
      : redirect.to;
    return new Response(null, {
      status: redirect.code || 301,
      headers: {
        Location: dest,
        "Cache-Control": "public, max-age=60",
        ...securityHeaders(false),
      },
    });
  }

  if (reqPath.startsWith("/_shared/")) {
    const rel = reqPath.slice("/_shared/".length);
    const file = await readSharedFromStore(store, rel);
    if (!file) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
          ...securityHeaders(false),
        },
      });
    }
    return respondWithFile(request, file, `_shared/${rel}`);
  }

  const candidatePaths =
    reqPath === "/"
      ? ["index.html"]
      : reqPath.endsWith("/")
        ? [`${reqPath.slice(1)}index.html`]
        : [reqPath.slice(1), `${reqPath.slice(1)}/index.html`, `${reqPath.slice(1)}.html`];

  for (const rel of candidatePaths) {
    const file = await readSiteFileFromStore(
      store,
      pointer.siteId,
      pointer.publishId,
      rel,
    );
    if (file) {
      return respondWithFile(request, file, rel);
    }
  }

  const notFoundFile = await readSiteFileFromStore(
    store,
    pointer.siteId,
    pointer.publishId,
    "404.html",
  );
  if (notFoundFile) {
    return respondWithFile(request, notFoundFile, "404.html", 404, "no-store");
  }

  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...securityHeaders(false),
    },
  });
}
