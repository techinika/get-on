import { contentTypeFor } from "./content-type";
import { isBot, isCountableLinkRequest, isCountableRequest } from "./bots";
import { DEFAULT_ROOT_DOMAIN, parseHost } from "./host";
import {
  domainNotConnectedPage,
  domainPausedPage,
  domainSupportPausedPage,
  notFoundPage,
  notPublishedPage,
  pausedPage,
  suspendedPage,
} from "./platform-pages";
import {
  PROBLEM_TEXTS,
  sanitizeBackPath,
  sanitizeProblemCode,
  sha256Hex,
  signFormToken,
  signWorkerRequest,
} from "./forms";
import type { SiteFile, SitePointer, SiteStore } from "./types";

export type HandleOptions = {
  /** The domain customer websites live under, for example get-on.tech. */
  rootDomain?: string;
  /**
   * The path exactly as it arrived, before the URL parser tidied it up.
   * Adapters that still have the original text pass it here so that
   * traversal attempts can be refused with a 400.
   */
  rawPath?: string;
  /** Shared secret used to sign/verify form tokens. */
  formTokenSecret?: string;
  /** Previous form token secret, for rotation. */
  formTokenSecretPrevious?: string;
  /** Shared secret for signing requests to the app. */
  workerSharedSecret?: string;
  /** The app origin that receives forwarded form submissions. */
  appOrigin?: string;
  /** The client IP as seen by the adapter. */
  clientIp?: string;
  /** Fetch implementation, injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Keeps background work alive in the Cloudflare Worker. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Daily-rotating salt used to count visitors without storing IPs. */
  statsSaltSecret?: string;
};

const FORM_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const MAX_FORM_BODY = 16 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

/**
 * Replaces every GS placeholder in an HTML buffer. It runs after the cache
 * lookup, so the cached base is never personalised.
 */
export async function resolveFormPlaceholders(
  html: string,
  request: Request,
  siteId: string,
  secrets: string[],
): Promise<string> {
  if (!html.includes("{{GS_")) return html;
  const url = new URL(request.url);
  let out = html;

  const tokenRe = /\{\{GS_FORM_TOKEN:([^}]+)\}\}/g;
  for (const match of html.matchAll(tokenRe)) {
    const formId = match[1]!;
    if (!FORM_ID_RE.test(formId)) continue;
    const token = await signFormToken(secrets[0] ?? "", {
      s: siteId,
      f: formId,
      t: Date.now(),
    });
    out = out.split(match[0]).join(token);
  }

  out = out.replace(/\{\{GS_PAGE_PATH\}\}/g, sanitizeBackPath(url.pathname));
  out = out.replace(
    /\{\{GS_BACK\}\}/g,
    sanitizeBackPath(url.searchParams.get("b") ?? "/"),
  );
  out = out.replace(
    /\{\{GS_PROBLEM_TEXT\}\}/g,
    PROBLEM_TEXTS[sanitizeProblemCode(url.searchParams.get("c"))] ?? PROBLEM_TEXTS.unavailable,
  );
  return out;
}

function cacheControlFor(
  path: string,
  kind: "html" | "asset" | "listing" | "platform",
): string {
  switch (kind) {
    case "asset":
      return "public, max-age=31536000, immutable";
    case "listing":
      return "public, max-age=3600";
    case "platform":
      return "public, max-age=60";
    case "html":
    default:
      return "public, max-age=60, stale-while-revalidate=300";
  }
}

function isListingFile(path: string): boolean {
  return (
    path === "sitemap.xml" ||
    path === "robots.txt" ||
    path === "favicon.ico" ||
    path === "favicon-32.png" ||
    path === "apple-touch-icon.png"
  );
}

function decodePath(
  pathname: string,
): { ok: true; path: string } | { ok: false } {
  if (pathname.includes("..")) return { ok: false };
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { ok: false };
  }
  if (decoded.includes("..")) return { ok: false };
  if (decoded.includes("\\")) return { ok: false };
  if (decoded.includes("\0")) return { ok: false };
  if (decoded.includes("//")) return { ok: false };
  return { ok: true, path: decoded };
}

/** True when a path may not be served at all. */
export function isUnsafePath(path: string): boolean {
  if (path.includes("..")) return true;
  if (path.includes("\\")) return true;
  if (path.includes("\0")) return true;
  if (path.includes("//")) return true;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return true;
  }
  if (decoded.includes("..")) return true;
  if (decoded.includes("\\")) return true;
  if (decoded.includes("\0")) return true;
  if (decoded.includes("//")) return true;
  return false;
}

/** The file inside a published version that answers a request path. */
export function filePathFor(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (clean === "") return "index.html";
  if (clean.includes("/")) {
    const last = clean.slice(clean.lastIndexOf("/") + 1);
    if (!last.includes(".")) return `${clean}/index.html`;
    return clean;
  }
  if (!clean.includes(".")) return `${clean}/index.html`;
  return clean;
}

function permanentRedirect(location: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      Location: location,
      "Cache-Control": "public, max-age=300",
      ...SECURITY_HEADERS,
    },
  });
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: location,
      "Cache-Control": "public, max-age=60",
      ...SECURITY_HEADERS,
    },
  });
}

function movedResponse(location: string, code: number): Response | null {
  if (!location || /[\r\n]/.test(location)) return null;
  if (location.startsWith("/")) {
    if (
      location.startsWith("//") ||
      location.includes("\\") ||
      location.includes("..")
    ) {
      return null;
    }
  } else {
    try {
      const url = new URL(location);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    } catch {
      return null;
    }
  }
  const status = code === 301 || code === 302 || code === 307 || code === 308
    ? code
    : 301;
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "public, max-age=60",
      ...SECURITY_HEADERS,
    },
  });
}

function withSearch(location: string, search: string): string {
  if (!search || location.includes("?")) return location;
  const hashAt = location.indexOf("#");
  return hashAt === -1
    ? `${location}${search}`
    : `${location.slice(0, hashAt)}${search}${location.slice(hashAt)}`;
}

function badRequest(): Response {
  return new Response("Bad request", {
    status: 400,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

function platformResponse(
  html: string,
  status: number,
  cacheControl: string,
  extra: Record<string, string> = {},
): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Robots-Tag": "noindex",
      ...SECURITY_HEADERS,
      ...extra,
    },
  });
}

async function fileResponse(
  file: SiteFile,
  request: Request,
  path: string,
  kind: "html" | "asset" | "listing",
  status = 200,
): Promise<Response> {
  const headers = new Headers({
    "Content-Type": file.contentType,
    "Cache-Control": cacheControlFor(path, kind),
    ETag: file.etag,
    Vary: "Accept-Encoding",
    ...SECURITY_HEADERS,
  });

  const inm = request.headers.get("if-none-match");
  if (
    inm &&
    inm
      .split(",")
      .some(
        (tag) => tag.trim() === file.etag || tag.trim() === `W/${file.etag}`,
      )
  ) {
    return new Response(null, { status: 304, headers });
  }

  headers.set("Content-Length", String(file.size));
  if (request.method === "HEAD") {
    return new Response(null, { status, headers });
  }
  return new Response(file.body as unknown as BodyInit, { status, headers });
}

/**
 * Serves one request for a customer website. The same function runs in the
 * Cloudflare Worker and in the local Node server, so the rules cannot drift.
 */
export async function handleSiteRequest(
  request: Request,
  store: SiteStore,
  options: HandleOptions = {},
): Promise<Response> {
  const host = parseHost(
    request.headers.get("host"),
    options.rootDomain ?? DEFAULT_ROOT_DOMAIN,
  );
  const response = await serveSiteRequest(request, store, options);

  // A customer domain must not pin its subdomains or ask browsers to preload.
  if (host.ok && host.custom) {
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
}

function canonicalTarget(
  pointer: SitePointer,
  host: { hostname: string; custom?: boolean },
): string | null {
  const primary = pointer.primaryHost?.toLowerCase().replace(/\.$/, "");
  if (!primary || primary === host.hostname) return null;

  const freeHost = pointer.freeHost?.toLowerCase().replace(/\.$/, "");
  const isFreeAddress = freeHost === host.hostname;
  if (host.custom !== true && !(isFreeAddress && pointer.redirectToPrimary === true)) {
    return null;
  }

  return primary;
}

const LINK_CODE_RE = /^[a-z2-9]{7,10}$/;
const TRACKED_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
]);

function linkGonePage(homeUrl: string | null): string {
  const home = homeUrl
    ? `<p><a href="${homeUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">Go to the website</a></p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Link no longer active</title><style>body{font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#faf8f4;color:#1f1a17;padding:24px}main{max-width:34rem;background:#fff;border:1px solid #e7e1d8;border-radius:16px;padding:28px}a{color:#0b6b4f;font-weight:600}</style></head><body><main><h1>This link is no longer active</h1><p>The business has turned this link off. You can still visit the website.</p>${home}</main></body></html>`;
}

async function sendStatsEvent(
  request: Request,
  options: HandleOptions,
  event: {
    kind: "view" | "click";
    siteId: string;
    projectId: string;
    path: string;
    linkCode?: string | null;
    params: Record<string, string>;
  },
): Promise<void> {
  const appOrigin = options.appOrigin;
  const secret = options.workerSharedSecret ?? "";
  if (!appOrigin || !secret) return;
  const date = new Date().toISOString().slice(0, 10);
  const ua = request.headers.get("user-agent") ?? "";
  const ip = options.clientIp ?? request.headers.get("cf-connecting-ip") ?? "";
  const salt = options.statsSaltSecret ?? secret;
  const visitorHash = await sha256Hex(`${salt}:${date}:${ip}:${ua}`);
  const body = JSON.stringify({
    kind: event.kind,
    siteId: event.siteId,
    projectId: event.projectId,
    date,
    path: event.path,
    visitorHash,
    linkCode: event.linkCode ?? null,
    params: event.params,
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyHash = await sha256Hex(body);
  const sig = await signWorkerRequest(secret, {
    ts,
    host: new URL(request.url).hostname,
    ip: "",
    bodyHash,
  });
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    await doFetch(`${appOrigin.replace(/\/$/, "")}/api/stats/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gs-host": new URL(request.url).hostname,
        "x-gs-ip": "",
        "x-gs-ts": ts,
        "x-gs-sig": sig,
      },
      body,
      signal: controller.signal,
    });
  } catch {
    // Counting never blocks the visitor.
  } finally {
    clearTimeout(timeout);
  }
}

async function handleTrackedLink(
  request: Request,
  url: URL,
  hostname: string,
  store: SiteStore,
  options: HandleOptions,
): Promise<Response> {
  const code = url.pathname.slice("/_l/".length);
  if (!LINK_CODE_RE.test(code)) {
    return platformResponse(linkGonePage(null), 404, "no-store");
  }
  const link = await store.getLink?.(code);
  const pointer = await store.getPointer(hostname);
  const protocol = url.protocol;
  const mainHost = pointer?.primaryHost || hostname;
  const homeUrl = pointer ? `${protocol}//${mainHost}/` : null;

  if (!link || !link.active || !pointer || pointer.state !== "live") {
    return platformResponse(linkGonePage(homeUrl), link ? 410 : 404, "no-store");
  }

  const target = new URL(`${protocol}//${mainHost}${link.targetPath}`);
  for (const [key, value] of Object.entries(link.params ?? {})) {
    if (TRACKED_PARAMS.has(key) && typeof value === "string") {
      target.searchParams.set(key, value.slice(0, 200));
    }
  }
  for (const [key, value] of url.searchParams) {
    if (TRACKED_PARAMS.has(key) && !target.searchParams.has(key)) {
      target.searchParams.set(key, value.slice(0, 200));
    }
  }

  if (
    request.method === "GET" &&
    isCountableLinkRequest({ method: request.method, headers: request.headers, userAgent: request.headers.get("user-agent") })
  ) {
    const event = sendStatsEvent(request, options, {
      kind: "click",
      siteId: link.siteId,
      projectId: link.projectId,
      path: link.targetPath,
      linkCode: code,
      params: Object.fromEntries(target.searchParams),
    });
    if (options.waitUntil) options.waitUntil(event);
    else void event;
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

async function serveSiteRequest(
  request: Request,
  store: SiteStore,
  options: HandleOptions = {},
): Promise<Response> {
  const rootDomain = options.rootDomain ?? DEFAULT_ROOT_DOMAIN;
  const url = new URL(request.url);

  const isFormPost =
    request.method === "POST" && /^\/_forms\/[A-Za-z0-9_-]{6,32}$/.test(url.pathname);

  if (request.method !== "GET" && request.method !== "HEAD" && !isFormPost) {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }

  const host = parseHost(request.headers.get("host"), rootDomain);
  if (!host.ok) {
    return platformResponse(
      notFoundPage(),
      404,
      cacheControlFor("", "platform"),
    );
  }

  if (isFormPost) {
    return handleFormPost(request, url, host.hostname, store, options);
  }

  if (url.pathname.startsWith("/_l/")) {
    return handleTrackedLink(request, url, host.hostname, store, options);
  }

  if (options.rawPath && isUnsafePath(options.rawPath)) {
    return badRequest();
  }

  const decoded = decodePath(url.pathname);
  if (!decoded.ok) {
    return badRequest();
  }

  const path = decoded.path;

  // Lower case only. Form paths are exempt because block ids are mixed case.
  if (path !== path.toLowerCase() && !path.startsWith("/_forms")) {
    return redirect(`${url.pathname.toLowerCase()}${url.search}`);
  }

  // A trailing slash means the same page without it.
  if (path.length > 1 && path.endsWith("/")) {
    return redirect(`${path.replace(/\/+$/, "")}${url.search}`);
  }

  // /index.html and /page/index.html are the clean address.
  if (path === "/index.html") {
    return redirect(`/${url.search}`);
  }
  if (path.endsWith("/index.html")) {
    const clean = path.slice(0, -"index.html".length).replace(/\/+$/, "");
    return redirect(`${clean}${url.search}`);
  }

  const pointer = await store.getPointer(host.hostname);
  if (!pointer) {
    return platformResponse(
      host.custom ? domainNotConnectedPage() : notFoundPage(),
      404,
      cacheControlFor("", "platform"),
    );
  }

  if (pointer.state === "suspended") {
    return platformResponse(suspendedPage(host.name), 403, "no-store");
  }
  if (pointer.state !== "live") {
    return platformResponse(
      notPublishedPage(),
      404,
      cacheControlFor("", "platform"),
    );
  }

  if (pointer.supportPaused) {
    return platformResponse(domainSupportPausedPage(), 503, "no-store", {
      "Retry-After": "3600",
    });
  }

  if (pointer.planLapsed) {
    return platformResponse(domainPausedPage(), 503, "no-store", {
      "Retry-After": "3600",
    });
  }

  if (path === "/_gs/health") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...SECURITY_HEADERS,
      },
    });
  }

  const primary = canonicalTarget(pointer, host);
  if (
    primary &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    return permanentRedirect(`https://${primary}${url.pathname}${url.search}`);
  }

  if (pointer.pause) {
    return platformResponse(
      pausedPage(pointer.pause.title, pointer.pause.text),
      503,
      "no-store",
      { "Retry-After": "3600" },
    );
  }

  const moved = pointer.redirects?.find((item) => item.from === path);
  if (moved) {
    const response = movedResponse(
      withSearch(moved.to, url.search),
      moved.code,
    );
    if (response) return response;
  }

  const filePath = filePathFor(path);
  const isShared = filePath.startsWith("fonts/");
  const isPlatformFormPage = path === "/_forms/sent" || path === "/_forms/problem";
  const file = isShared
    ? ((await store.getSharedFile?.(filePath)) ??
      (await store.getFile(pointer.siteId, pointer.publishId, filePath)))
    : await store.getFile(pointer.siteId, pointer.publishId, filePath);

  if (!file) {
    const notFoundFile = await store.getFile(
      pointer.siteId,
      pointer.publishId,
      "404.html",
    );
    if (notFoundFile) {
      return fileResponse(notFoundFile, request, "404.html", "html", 404);
    }
    return platformResponse(
      notFoundPage(),
      404,
      cacheControlFor("", "platform"),
    );
  }

  const kind: "html" | "asset" | "listing" = filePath.startsWith("assets/")
    ? "asset"
    : isShared
      ? "asset"
      : isListingFile(filePath)
        ? "listing"
        : "html";

  if (isPlatformFormPage && (request.method === "GET" || request.method === "HEAD")) {
    const html = new TextDecoder().decode(file.body);
    const replaced = await resolveFormPlaceholders(html, request, pointer.siteId, tokenSecrets(options));
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...SECURITY_HEADERS,
    });
    if (request.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(replaced, { status: 200, headers });
  }

  // Replace personalised placeholders on HTML responses, after the cache.
  if (kind === "html" && (request.method === "GET" || request.method === "HEAD")) {
    const needsReplace = file.contentType.includes("html");
    if (needsReplace) {
      const response = await fileResponse(file, request, filePath, kind);
      if (response.status === 200 || response.status === 404) {
        const html = new TextDecoder().decode(file.body);
        if (html.includes("{{GS_")) {
          const replaced = await resolveFormPlaceholders(html, request, pointer.siteId, tokenSecrets(options));
          const headers = new Headers(response.headers);
          headers.delete("Content-Length");
          headers.delete("ETag");
          // The page carries a signed token, so it must never be cached.
          headers.set("Cache-Control", "no-store");
          if (request.method === "HEAD") return new Response(null, { status: response.status, headers });
          return new Response(replaced, { status: response.status, headers });
        }
      }
      return response;
    }
  }

  // Count visible HTML page views. The personalised placeholder pass runs
  // above, so this always sees the final content before it is served.
  if (
    kind === "html" &&
    file.contentType.includes("html") &&
    request.method === "GET" &&
    isCountableRequest({
      method: request.method,
      headers: request.headers,
      path: url.pathname,
      userAgent: request.headers.get("user-agent"),
    })
  ) {
    const params: Record<string, string> = {};
    for (const [key, value] of url.searchParams) params[key] = value;
    void sendStatsEvent(request, options, {
      kind: "view",
      siteId: pointer.siteId,
      projectId: pointer.siteId,
      path: path,
      linkCode: typeof params["gs_link"] === "string" ? params["gs_link"] : null,
      params,
    }).catch(() => undefined);
  }

  return fileResponse(file, request, filePath, kind);
}

function tokenSecrets(options: HandleOptions): string[] {
  const secrets = [options.formTokenSecret ?? ""];
  if (options.formTokenSecretPrevious) secrets.push(options.formTokenSecretPrevious);
  return secrets;
}

function formRedirect(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    },
  });
}

async function handleFormPost(
  request: Request,
  url: URL,
  hostname: string,
  store: SiteStore,
  options: HandleOptions,
): Promise<Response> {
  const formId = url.pathname.slice("/_forms/".length);
  const back = sanitizeBackPath(url.searchParams.get("b"));
  const problem = (code: string) =>
    formRedirect(`/_forms/problem?c=${code}&b=${encodeURIComponent(back)}`);
  const sent = () => formRedirect(`/_forms/sent?b=${encodeURIComponent(back)}`);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return new Response("Unsupported media type", {
      status: 415,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS },
    });
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_FORM_BODY) {
    return new Response("Payload too large", {
      status: 413,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...SECURITY_HEADERS },
    });
  }

  const pointer = await store.getPointer(hostname);
  if (!pointer || pointer.state !== "live") {
    return problem("closed");
  }

  const appOrigin = options.appOrigin;
  if (!appOrigin) {
    return problem("unavailable");
  }

  const ip = options.clientIp ?? request.headers.get("cf-connecting-ip") ?? "";
  const ua = (request.headers.get("user-agent") ?? "").slice(0, 200);
  const ts = String(Math.floor(Date.now() / 1000));
  const bodyHash = await sha256Hex(body);
  const sig = await signWorkerRequest(options.workerSharedSecret ?? "", {
    ts,
    host: hostname,
    ip,
    bodyHash,
  });

  const doFetch = options.fetchImpl ?? fetch;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const forwardUrl = `${appOrigin.replace(/\/$/, "")}/api/public/forms/${formId}`;
    const response = await doFetch(forwardUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-gs-host": hostname,
        "x-gs-ip": ip,
        "x-gs-ua": ua,
        "x-gs-ts": ts,
        "x-gs-sig": sig,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (response.ok) return sent();
    if (response.status === 400 || response.status === 413) return problem("invalid");
    if (response.status === 429) return problem("rate");
    if (response.status === 403 || response.status === 404) return problem("closed");
    return problem("unavailable");
  } catch {
    return problem("unavailable");
  }
}

export { contentTypeFor };
