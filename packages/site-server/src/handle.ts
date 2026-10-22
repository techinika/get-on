import { contentTypeFor } from "./content-type";
import { DEFAULT_ROOT_DOMAIN, parseHost } from "./host";
import {
  notFoundPage,
  notPublishedPage,
  suspendedPage,
} from "./platform-pages";
import type { SiteFile, SiteStore } from "./types";

export type HandleOptions = {
  /** The domain customer websites live under, for example get-on.tech. */
  rootDomain?: string;
  /**
   * The path exactly as it arrived, before the URL parser tidied it up.
   * Adapters that still have the original text pass it here so that
   * traversal attempts can be refused with a 400.
   */
  rawPath?: string;
};

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

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
  const rootDomain = options.rootDomain ?? DEFAULT_ROOT_DOMAIN;

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
        ...SECURITY_HEADERS,
      },
    });
  }

  const url = new URL(request.url);
  const host = parseHost(request.headers.get("host"), rootDomain);
  if (!host.ok) {
    return platformResponse(
      notFoundPage(),
      404,
      cacheControlFor("", "platform"),
    );
  }

  if (options.rawPath && isUnsafePath(options.rawPath)) {
    return badRequest();
  }

  const decoded = decodePath(url.pathname);
  if (!decoded.ok) {
    return badRequest();
  }

  const path = decoded.path;

  // Lower case only.
  if (path !== path.toLowerCase()) {
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
      notFoundPage(),
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

  const filePath = filePathFor(path);
  const isShared = filePath.startsWith("fonts/");
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

  return fileResponse(file, request, filePath, kind);
}

export { contentTypeFor };
