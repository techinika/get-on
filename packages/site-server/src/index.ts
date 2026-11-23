export const DEFAULT_ROOT_DOMAIN = "get-on.tech";

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
  state: "live" | "offline" | "review" | "suspended" | "unpublished";
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

export type StoredObject = {
  body: ArrayBuffer | Uint8Array;
  contentType?: string | null;
  etag?: string | null;
};

export type SiteStore = {
  getPointer(hostname: string): Promise<SitePointer | null>;
  getObject(key: string): Promise<StoredObject | null>;
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
  const normalizedRoot = rootDomain.trim().toLowerCase().split(":")[0] ?? DEFAULT_ROOT_DOMAIN;
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
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
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

function sanitizePath(rawPath: string): string {
  const clean = rawPath.split("?")[0]?.split("#")[0] ?? "/";
  if (clean.includes("..")) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
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
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const pointer = await store.getPointer(parsedHost.hostname);
  if (!pointer || pointer.state !== "live") {
    return new Response("Site unavailable", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (pointer.supportPaused || pointer.planLapsed) {
    const title = pointer.pause?.title || "Site temporarily unavailable";
    const text = pointer.pause?.text || "Please check back soon.";
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:48px;text-align:center"><h1>${title}</h1><p>${text}</p></body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }

  const reqPath = sanitizePath(options.rawPath ?? new URL(request.url).pathname);

  if (!parsedHost.custom && pointer.primaryHost && pointer.redirectFreeAddress !== false) {
    return Response.redirect(`https://${pointer.primaryHost}${reqPath}`, 301);
  }

  const redirect = pointer.redirects?.find((r) => r.from === reqPath);
  if (redirect) {
    return Response.redirect(
      redirect.to.startsWith("/") ? new URL(redirect.to, request.url).toString() : redirect.to,
      redirect.code || 301,
    );
  }

  if (reqPath.startsWith("/_shared/")) {
    const sharedKey = `sites/${reqPath.slice(1)}`;
    const obj = await store.getObject(sharedKey);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType ?? contentTypeFor(reqPath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const candidatePaths =
    reqPath === "/"
      ? ["index.html"]
      : reqPath.endsWith("/")
        ? [`${reqPath.slice(1)}index.html`]
        : [reqPath.slice(1), `${reqPath.slice(1)}/index.html`, `${reqPath.slice(1)}.html`];

  for (const rel of candidatePaths) {
    const key = `sites/${pointer.siteId}/v/${pointer.publishId}/${rel}`;
    const obj = await store.getObject(key);
    if (obj) {
      return new Response(request.method === "HEAD" ? null : (obj.body as BodyInit), {
        status: 200,
        headers: {
          "Content-Type": obj.contentType ?? contentTypeFor(rel),
          "Cache-Control": "public, max-age=60",
        },
      });
    }
  }

  const notFoundObj = await store.getObject(
    `sites/${pointer.siteId}/v/${pointer.publishId}/404.html`,
  );
  if (notFoundObj) {
    return new Response(notFoundObj.body as BodyInit, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
